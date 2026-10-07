import { z } from "zod";

export const gradeLevelSchema = z.union([z.literal(5), z.literal(6), z.literal(7), z.literal("mixed")]);
export const claimNicknameSchema = z.object({ nickname: z.string().min(2).max(20), gradeLevel: gradeLevelSchema });
export const heartbeatSchema = z.object({ sessionId: z.string().min(8), reconnectToken: z.string().min(16) });
export const reconnectSchema = heartbeatSchema;
export const disconnectSchema = heartbeatSchema;
export const answerSubmissionSchema = z.object({
  sessionId: z.string().min(8),
  matchId: z.string().min(8),
  questionId: z.string().min(3),
  answer: z.string().min(1).max(64),
  clientSubmissionId: z.string().min(8).max(100)
});
export type ClaimNicknameInput = z.infer<typeof claimNicknameSchema>;
