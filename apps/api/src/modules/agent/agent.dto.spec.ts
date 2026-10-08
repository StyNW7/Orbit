import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ChatDto, ToolCallDto } from './agent.module';

const errorsFor = <T extends object>(cls: new () => T, plain: object) =>
  validateSync(plainToInstance(cls, plain) as object, { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);

describe('API DTO validation', () => {
  describe('ChatDto (POST /agent/chat)', () => {
    it('accepts a message with optional page context', () => {
      expect(errorsFor(ChatDto, { message: 'What should I focus on this week?' })).toEqual([]);
      expect(errorsFor(ChatDto, { message: 'Why this skill?', pageContext: { page: 'universe', label: 'Product Analytics' } })).toEqual([]);
    });

    it('rejects empty, oversized or malformed input', () => {
      expect(errorsFor(ChatDto, { message: '' })).toContain('message');
      expect(errorsFor(ChatDto, { message: 'x'.repeat(2001) })).toContain('message');
      expect(errorsFor(ChatDto, { message: 'hi', conversationId: 'not-a-uuid' })).toContain('conversationId');
      expect(errorsFor(ChatDto, { message: 'hi', pageContext: { page: 'admin-panel' } })).toContain('pageContext');
    });

    it('rejects unknown properties', () => {
      expect(errorsFor(ChatDto, { message: 'hi', role: 'system' })).toContain('role');
    });
  });

  describe('ToolCallDto (POST /agent/tools/:tool)', () => {
    it('requires a session id and an object of args', () => {
      expect(errorsFor(ToolCallDto, { session_id: '72de42f2-7f2d-469b-807b-4745dee0dfed', args: { skill: 'sql' } })).toEqual([]);
      expect(errorsFor(ToolCallDto, { args: {} })).toContain('session_id');
      expect(errorsFor(ToolCallDto, { session_id: 'short' })).toContain('session_id');
      expect(errorsFor(ToolCallDto, { session_id: '72de42f2-7f2d-469b-807b-4745dee0dfed', args: 'drop table' })).toContain('args');
    });
  });
});
