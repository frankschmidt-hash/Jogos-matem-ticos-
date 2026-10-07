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

const crazyAuthSchema=heartbeatSchema;
export const crazyCreateRoomSchema=crazyAuthSchema.extend({
  password:z.string().min(4).max(32)
});
export const crazyJoinRoomSchema=crazyAuthSchema.extend({
  code:z.string().min(4).max(8),
  password:z.string().min(4).max(32)
});
export const crazyRoomActionSchema=crazyAuthSchema.extend({
  code:z.string().min(4).max(8)
});
export const crazyAnswerSchema=crazyRoomActionSchema.extend({
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64),
  clientSubmissionId:z.string().min(8).max(120)
});
export const crazyBombSchema=crazyRoomActionSchema.extend({
  direction:z.enum(["ahead","behind"])
});
export const crazyBombAnswerSchema=crazyRoomActionSchema.extend({
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64)
});

export type ClaimNicknameInput = z.infer<typeof claimNicknameSchema>;

export const numberCreateRoomSchema=heartbeatSchema.extend({
  password:z.string().min(4).max(32),
  gradeLevel:gradeLevelSchema
});
export const numberJoinRoomSchema=heartbeatSchema.extend({
  code:z.string().min(4).max(8),
  password:z.string().min(4).max(32)
});
export const numberRoomActionSchema=heartbeatSchema.extend({
  code:z.string().min(4).max(8)
});
export const numberAnswerSchema=numberRoomActionSchema.extend({
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64),
  clientSubmissionId:z.string().min(8).max(120)
});
