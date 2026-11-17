-- Parent care: the parent's switch for the store rating invitation (review_invite, lib/review-prompts).
-- AlterTable
ALTER TABLE "ParentCarePreference" ADD COLUMN     "feedbackInvites" BOOLEAN NOT NULL DEFAULT true;

