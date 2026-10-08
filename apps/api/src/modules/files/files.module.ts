import {
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilePurpose, StorageProvider, type StoredFile } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { CvUploadResult, StoredFileView } from '@orbit/shared';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppError, badRequest, notFound } from '../../common/http/errors';
import { toFileView } from '../../common/mappers';
import { CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';

// pdf-parse's index runs a debug harness on import; load the library entry directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (data: Buffer) => Promise<{ text: string; numpages: number }> = require('pdf-parse/lib/pdf-parse.js');

const MB = 1024 * 1024;
const RULES: Record<FilePurpose, { types: string[]; maxBytes: number }> = {
  CV: { types: ['application/pdf'], maxBytes: 5 * MB },
  EVIDENCE: { types: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'], maxBytes: 8 * MB },
  CERTIFICATE: { types: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'], maxBytes: 8 * MB },
  DOCUMENT: { types: ['application/pdf', 'text/plain'], maxBytes: 8 * MB },
};

interface UploadedBlob {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

function sniffMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString() === 'PNG') return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  private supabase: SupabaseClient | null = null;
  private readonly localRoot = resolve(process.cwd(), 'uploads');

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.config.supabaseStorageEnabled) {
      this.logger.log(`Using local file storage at ${this.localRoot}`);
      return;
    }
    this.supabase = createClient(this.config.env.SUPABASE_URL!, this.config.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const bucket = this.config.env.SUPABASE_STORAGE_BUCKET;
    const { data } = await this.supabase.storage.getBucket(bucket);
    if (!data) {
      const { error } = await this.supabase.storage.createBucket(bucket, { public: false, fileSizeLimit: 10 * MB });
      if (error) this.logger.warn(`Could not create bucket ${bucket}: ${error.message}`);
    }
    this.logger.log(`Using Supabase Storage bucket "${bucket}"`);
  }

  validate(file: UploadedBlob | undefined, purpose: FilePurpose): asserts file is UploadedBlob {
    if (!file) throw badRequest('No file received.');
    const rule = RULES[purpose];
    if (file.size > rule.maxBytes) {
      throw new AppError('FILE_TOO_LARGE', `File is too large. Maximum size is ${rule.maxBytes / MB} MB.`, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const sniffed = sniffMime(file.buffer) ?? (file.mimetype === 'text/plain' ? 'text/plain' : null);
    if (!sniffed || !rule.types.includes(sniffed)) {
      const allowed = rule.types.map((t) => t.split('/')[1].toUpperCase()).join(', ');
      throw new AppError('UNSUPPORTED_FILE', `Unsupported file type. Please upload ${allowed}.`, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    file.mimetype = sniffed;
  }

  async upload(userId: string, file: UploadedBlob, purpose: FilePurpose): Promise<StoredFile> {
    this.validate(file, purpose);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
    const path = `${userId}/${purpose.toLowerCase()}/${randomUUID()}-${safeName}`;
    let provider: StorageProvider = 'LOCAL';
    try {
      if (this.supabase) {
        const { error } = await this.supabase.storage
          .from(this.config.env.SUPABASE_STORAGE_BUCKET)
          .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
        if (error) throw new Error(error.message);
        provider = 'SUPABASE';
      } else {
        const full = join(this.localRoot, path);
        await mkdir(join(full, '..'), { recursive: true });
        await writeFile(full, file.buffer);
      }
    } catch (error) {
      this.logger.error(`Upload failed: ${(error as Error).message}`);
      throw new AppError('UPLOAD_FAILED', 'We could not store your file. Please try again.', HttpStatus.SERVICE_UNAVAILABLE, true);
    }
    return this.prisma.storedFile.create({
      data: {
        userId,
        provider,
        bucket: this.supabase ? this.config.env.SUPABASE_STORAGE_BUCKET : 'local',
        path,
        filename: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        size: file.size,
        purpose,
      },
    });
  }

  async read(userId: string, fileId: string): Promise<{ file: StoredFile; data: Buffer }> {
    const file = await this.prisma.storedFile.findFirst({ where: { id: fileId, userId } });
    if (!file) throw notFound('File');
    if (file.provider === 'SUPABASE') {
      if (!this.supabase) throw new AppError('STORAGE_UNAVAILABLE', 'File storage is not configured.', HttpStatus.SERVICE_UNAVAILABLE);
      const { data, error } = await this.supabase.storage.from(file.bucket).download(file.path);
      if (error || !data) throw new AppError('STORAGE_UNAVAILABLE', 'We could not retrieve this file.', HttpStatus.SERVICE_UNAVAILABLE, true);
      return { file, data: Buffer.from(await data.arrayBuffer()) };
    }
    return { file, data: await readFile(join(this.localRoot, file.path)) };
  }

  async extractText(file: UploadedBlob): Promise<string> {
    try {
      if (file.mimetype === 'text/plain') return file.buffer.toString('utf8');
      const parsed = await pdfParse(file.buffer);
      return parsed.text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    } catch {
      throw new AppError('CV_PARSE_FAILED', 'We could not read this PDF. Try exporting it again as a text-based PDF, or paste your CV text instead.');
    }
  }
}

@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('cv')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * MB } }))
  async uploadCv(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedBlob): Promise<CvUploadResult> {
    this.storage.validate(file, 'CV');
    const text = await this.storage.extractText(file);
    if (text.length < 80) {
      throw new AppError(
        'CV_NO_TEXT',
        'This PDF does not contain readable text (it may be a scanned image). Please upload a text-based PDF or paste your CV text.',
      );
    }
    const stored = await this.storage.upload(user.id, file, 'CV');
    await this.prisma.careerProfile.upsert({
      where: { userId: user.id },
      update: { cvFileId: stored.id, cvText: text },
      create: { userId: user.id, cvFileId: stored.id, cvText: text },
    });
    return { file: toFileView(stored)!, characters: text.length, preview: text.slice(0, 600) };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * MB } }))
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedBlob,
    @Query('purpose') purpose: string = 'EVIDENCE',
  ): Promise<StoredFileView> {
    const p = (Object.values(FilePurpose) as string[]).includes(purpose) && purpose !== 'CV' ? (purpose as FilePurpose) : 'EVIDENCE';
    const stored = await this.storage.upload(user.id, file, p);
    return toFileView(stored)!;
  }

  @Get(':id')
  async download(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { file, data } = await this.storage.read(user.id, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(data);
  }
}

@Module({ controllers: [FilesController], providers: [StorageService], exports: [StorageService] })
export class FilesModule {}
