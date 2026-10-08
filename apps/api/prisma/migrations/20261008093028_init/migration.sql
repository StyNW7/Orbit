-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'SUPABASE');

-- CreateEnum
CREATE TYPE "ExtractionSource" AS ENUM ('AI', 'HEURISTIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'HYBRID', 'REMOTE');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('FULL_TIME', 'INTERNSHIP', 'GRADUATE_PROGRAM', 'PART_TIME');

-- CreateEnum
CREATE TYPE "ExperienceType" AS ENUM ('WORK', 'INTERNSHIP', 'ORGANIZATION', 'PROJECT', 'COMPETITION', 'VOLUNTEER', 'LEADERSHIP', 'RESEARCH');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('AWARD', 'CERTIFICATION', 'PUBLICATION');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('PRODUCT', 'DATA', 'ENGINEERING', 'AI', 'DESIGN', 'BUSINESS', 'SOFT_SKILL');

-- CreateEnum
CREATE TYPE "SkillSource" AS ENUM ('CV', 'USER', 'QUEST', 'AGENT');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuestCategory" AS ENUM ('SKILL', 'PROJECT', 'PORTFOLIO', 'EXPERIENCE', 'KNOWLEDGE', 'CERTIFICATION', 'APPLICATION', 'INTERVIEW', 'NETWORKING');

-- CreateEnum
CREATE TYPE "ReadinessCategory" AS ENUM ('SKILL', 'EXPERIENCE', 'PORTFOLIO', 'KNOWLEDGE', 'APPLICATION', 'INTERVIEW');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('TEMPLATE', 'AGENT', 'USER');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('URL', 'FILE', 'TEXT', 'GITHUB', 'PORTFOLIO', 'CERTIFICATE');

-- CreateEnum
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('CV', 'EVIDENCE', 'CERTIFICATE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('SUPABASE', 'LOCAL');

-- CreateEnum
CREATE TYPE "Seniority" AS ENUM ('ENTRY', 'JUNIOR', 'MID', 'SENIOR');

-- CreateEnum
CREATE TYPE "SavedKind" AS ENUM ('OPPORTUNITY', 'BOOK', 'PAPER', 'EVENT', 'RESOURCE', 'ROLE_MODEL');

-- CreateEnum
CREATE TYPE "SavedStatus" AS ENUM ('SAVED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'PREPARING', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PersonKind" AS ENUM ('ROLE_MODEL', 'MENTOR');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WORKSHOP', 'SEMINAR', 'CONFERENCE', 'COMPETITION', 'HACKATHON', 'BOOTCAMP', 'CAREER_EVENT');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('COURSE', 'CERTIFICATION', 'ARTICLE', 'LEARNING_RESOURCE');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('INTERVIEW_REFLECTION', 'LEARNING_REFLECTION', 'CAREER_THOUGHT', 'EXPERIENCE_UPDATE', 'PERSONAL_DEVELOPMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('JOB_DEADLINE', 'EVENT_REMINDER', 'QUEST_DEADLINE', 'SAVED_OPPORTUNITY', 'WEEKLY_REVIEW', 'INACTIVE_JOURNEY', 'APPLICATION_FOLLOW_UP', 'CUSTOM_REMINDER', 'INSIGHT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SCHEDULED', 'DELIVERED', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('USER', 'CAREER_ROLE', 'SKILL', 'EXPERIENCE', 'OPPORTUNITY', 'MENTOR', 'ROLE_MODEL', 'PAPER', 'BOOK', 'COURSE', 'EVENT', 'CERTIFICATION', 'COMPETITION', 'PROJECT', 'QUEST', 'GAP', 'GOAL');

-- CreateEnum
CREATE TYPE "EdgeRelationship" AS ENUM ('TARGETS', 'HAS_SKILL', 'HAS_EXPERIENCE', 'REQUIRES', 'RECOMMENDED_FOR', 'IMPROVES', 'RELATED_TO', 'SUPPORTS', 'PART_OF', 'APPLIED_TO', 'LEARNED_FROM', 'INSPIRED_BY');

-- CreateEnum
CREATE TYPE "GraphSource" AS ENUM ('SYSTEM', 'USER', 'AGENT');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AgentActionLevel" AS ENUM ('READ', 'SUGGEST', 'WRITE');

-- CreateEnum
CREATE TYPE "AgentActionStatus" AS ENUM ('EXECUTED', 'SUGGESTED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('PATTERN', 'GAP', 'STRENGTH', 'OPPORTUNITY', 'INTERVIEW', 'PROGRESS');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('ACTIVE', 'DISMISSED', 'ACTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PROFILE_ANALYZED', 'GOAL_SET', 'JOURNEY_STARTED', 'TASK_COMPLETED', 'QUEST_COMPLETED', 'MILESTONE_COMPLETED', 'EVIDENCE_SUBMITTED', 'SKILL_ACQUIRED', 'EXPERIENCE_ADDED', 'APPLICATION_UPDATED', 'INTERVIEW_PRACTICED', 'NOTE_WRITTEN', 'RESOURCE_COMPLETED', 'READINESS_MILESTONE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "passwordHash" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "currentStatus" TEXT,
    "university" TEXT,
    "major" TEXT,
    "graduationYear" INTEGER,
    "location" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredWorkModes" "WorkMode"[] DEFAULT ARRAY[]::"WorkMode"[],
    "preferredLocations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredRoleTypes" "OpportunityType"[] DEFAULT ARRAY[]::"OpportunityType"[],
    "additionalContext" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "githubUrl" TEXT,
    "cvFileId" UUID,
    "cvText" TEXT,
    "cvParsedAt" TIMESTAMP(3),
    "extractionSource" "ExtractionSource",
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "embedding" vector(768),
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "field" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "gpa" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ExperienceType" NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT false,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AchievementType" NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "date" TIMESTAMP(3),
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL,
    "description" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "source" "SkillSource" NOT NULL DEFAULT 'USER',
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerRole" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'briefcase-business',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceSignals" JSONB NOT NULL DEFAULT '[]',
    "journeyTemplate" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleSkillRequirement" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "requiredLevel" INTEGER NOT NULL,
    "importance" INTEGER NOT NULL,

    CONSTRAINT "RoleSkillRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "motivation" TEXT,
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerJourney" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "JourneyStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastProgressAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" UUID NOT NULL,
    "journeyId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "impact" "ReadinessCategory",
    "skillId" UUID,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT,
    "category" "QuestCategory" NOT NULL,
    "impact" "ReadinessCategory" NOT NULL,
    "relatedSkillId" UUID,
    "skillGain" INTEGER NOT NULL DEFAULT 0,
    "estimatedEffort" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "evidenceRequirement" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" "ContentSource" NOT NULL DEFAULT 'TEMPLATE',
    "resources" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestTask" (
    "id" UUID NOT NULL,
    "questId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuestTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "id" UUID NOT NULL,
    "questId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID,
    "progressBefore" INTEGER NOT NULL,
    "progressAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestEvidence" (
    "id" UUID NOT NULL,
    "questId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "url" TEXT,
    "text" TEXT,
    "fileId" UUID,
    "aiReview" TEXT,
    "reviewStatus" "EvidenceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "StorageProvider" NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "workMode" "WorkMode" NOT NULL,
    "employmentType" "OpportunityType" NOT NULL,
    "seniority" "Seniority" NOT NULL DEFAULT 'ENTRY',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industry" TEXT,
    "applyUrl" TEXT,
    "salaryRange" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(768),
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL,
    "coverUrl" TEXT,
    "publishedYear" INTEGER,
    "pageCount" INTEGER,
    "level" TEXT,
    "infoUrl" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embedding" vector(768),
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchPaper" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "year" INTEGER,
    "venue" TEXT,
    "abstract" TEXT NOT NULL,
    "url" TEXT,
    "doi" TEXT,
    "citationCount" INTEGER,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embedding" vector(768),
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "organizer" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "registrationDeadline" TIMESTAMP(3),
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "cost" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "embedding" vector(768),
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "provider" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "durationHours" INTEGER,
    "level" TEXT,
    "cost" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embedding" vector(768),
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleModel" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "PersonKind" NOT NULL DEFAULT 'ROLE_MODEL',
    "name" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "careerSummary" TEXT NOT NULL,
    "publicSources" JSONB NOT NULL DEFAULT '[]',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "careerTransitions" JSONB NOT NULL DEFAULT '[]',
    "relatedRoleSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "earlyCareerSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "availability" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "embedding" vector(768),
    "embeddingModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedOpportunity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "SavedKind" NOT NULL,
    "status" "SavedStatus" NOT NULL DEFAULT 'SAVED',
    "opportunityId" UUID,
    "bookId" UUID,
    "paperId" UUID,
    "eventId" UUID,
    "resourceId" UUID,
    "roleModelId" UUID,
    "note" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "notes" TEXT,
    "prepChecklist" JSONB NOT NULL DEFAULT '[]',
    "statusHistory" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "applicationId" UUID,
    "roleTitle" TEXT NOT NULL,
    "company" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questions" JSONB NOT NULL DEFAULT '[]',
    "scores" JSONB,
    "summary" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'TEMPLATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerNote" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NoteType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "status" "NotificationStatus" NOT NULL DEFAULT 'DELIVERED',
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphNode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "source" "GraphSource" NOT NULL DEFAULT 'SYSTEM',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphEdge" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sourceNodeId" UUID NOT NULL,
    "targetNodeId" UUID NOT NULL,
    "relationship" "EdgeRelationship" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "source" "GraphSource" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessSnapshot" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID,
    "roleSlug" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "trigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInsight" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "InsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "suggestedAction" JSONB,
    "status" "InsightStatus" NOT NULL DEFAULT 'ACTIVE',
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "conversationId" UUID,
    "messageId" UUID,
    "type" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "level" "AgentActionLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "AgentActionStatus" NOT NULL,
    "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CareerProfile_userId_key" ON "CareerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerProfile_cvFileId_key" ON "CareerProfile"("cvFileId");

-- CreateIndex
CREATE INDEX "Education_userId_idx" ON "Education"("userId");

-- CreateIndex
CREATE INDEX "Experience_userId_idx" ON "Experience"("userId");

-- CreateIndex
CREATE INDEX "Achievement_userId_idx" ON "Achievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_skillId_key" ON "UserSkill"("userId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerRole_slug_key" ON "CareerRole"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RoleSkillRequirement_roleId_skillId_key" ON "RoleSkillRequirement"("roleId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerGoal_userId_roleId_key" ON "CareerGoal"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerJourney_goalId_key" ON "CareerJourney"("goalId");

-- CreateIndex
CREATE INDEX "CareerJourney_userId_idx" ON "CareerJourney"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_journeyId_key_key" ON "Milestone"("journeyId", "key");

-- CreateIndex
CREATE INDEX "Quest_userId_status_idx" ON "Quest"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_milestoneId_key_key" ON "Quest"("milestoneId", "key");

-- CreateIndex
CREATE INDEX "QuestProgress_userId_createdAt_idx" ON "QuestProgress"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_dedupeKey_key" ON "Opportunity"("dedupeKey");

-- CreateIndex
CREATE INDEX "Opportunity_source_externalId_idx" ON "Opportunity"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_dedupeKey_key" ON "Book"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchPaper_dedupeKey_key" ON "ResearchPaper"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Event_dedupeKey_key" ON "Event"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_dedupeKey_key" ON "Resource"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "RoleModel_slug_key" ON "RoleModel"("slug");

-- CreateIndex
CREATE INDEX "SavedOpportunity_userId_kind_idx" ON "SavedOpportunity"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_opportunityId_key" ON "SavedOpportunity"("userId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_bookId_key" ON "SavedOpportunity"("userId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_paperId_key" ON "SavedOpportunity"("userId", "paperId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_eventId_key" ON "SavedOpportunity"("userId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_resourceId_key" ON "SavedOpportunity"("userId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_roleModelId_key" ON "SavedOpportunity"("userId", "roleModelId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_opportunityId_key" ON "Application"("userId", "opportunityId");

-- CreateIndex
CREATE INDEX "CareerNote_userId_createdAt_idx" ON "CareerNote"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_status_scheduledAt_idx" ON "Notification"("userId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "GraphNode_userId_type_idx" ON "GraphNode"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "GraphNode_userId_key_key" ON "GraphNode"("userId", "key");

-- CreateIndex
CREATE INDEX "GraphEdge_userId_idx" ON "GraphEdge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GraphEdge_sourceNodeId_targetNodeId_relationship_key" ON "GraphEdge"("sourceNodeId", "targetNodeId", "relationship");

-- CreateIndex
CREATE INDEX "ReadinessSnapshot_userId_roleSlug_createdAt_idx" ON "ReadinessSnapshot"("userId", "roleSlug", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentConversation_userId_updatedAt_idx" ON "AgentConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentMessage_conversationId_createdAt_idx" ON "AgentMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentInsight_userId_status_idx" ON "AgentInsight"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInsight_userId_dedupeKey_key" ON "AgentInsight"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "AgentAction_userId_createdAt_idx" ON "AgentAction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerProfile" ADD CONSTRAINT "CareerProfile_cvFileId_fkey" FOREIGN KEY ("cvFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleSkillRequirement" ADD CONSTRAINT "RoleSkillRequirement_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CareerRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleSkillRequirement" ADD CONSTRAINT "RoleSkillRequirement_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CareerRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerJourney" ADD CONSTRAINT "CareerJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerJourney" ADD CONSTRAINT "CareerJourney_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "CareerGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "CareerJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_relatedSkillId_fkey" FOREIGN KEY ("relatedSkillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestTask" ADD CONSTRAINT "QuestTask_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestEvidence" ADD CONSTRAINT "QuestEvidence_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestEvidence" ADD CONSTRAINT "QuestEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestEvidence" ADD CONSTRAINT "QuestEvidence_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "ResearchPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_roleModelId_fkey" FOREIGN KEY ("roleModelId") REFERENCES "RoleModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerNote" ADD CONSTRAINT "CareerNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphNode" ADD CONSTRAINT "GraphNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessSnapshot" ADD CONSTRAINT "ReadinessSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessSnapshot" ADD CONSTRAINT "ReadinessSnapshot_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "CareerGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInsight" ADD CONSTRAINT "AgentInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
