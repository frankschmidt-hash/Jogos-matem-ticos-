import { z } from "zod";

export const gradeLevelSchema = z.union([z.literal(5), z.literal(6), z.literal(7), z.literal("mixed")]);
export const roomCodeSchema=z.string().trim().length(6).regex(/^[A-Za-z2-9]{6}$/);
export const roomPasswordSchema=z.string().min(4).max(32);
export const clientSubmissionIdSchema=z.string().min(8).max(120);
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
  password:roomPasswordSchema
});
export const crazyJoinRoomSchema=crazyAuthSchema.extend({
  code:roomCodeSchema,
  password:roomPasswordSchema
});
export const crazyRoomActionSchema=crazyAuthSchema.extend({
  code:roomCodeSchema
});
export const crazyAnswerSchema=crazyRoomActionSchema.extend({
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64),
  clientSubmissionId:clientSubmissionIdSchema
});
export const crazyBombSchema=crazyRoomActionSchema.extend({
  direction:z.enum(["ahead","behind"]),
  clientSubmissionId:clientSubmissionIdSchema
});
export const crazyBombAnswerSchema=crazyRoomActionSchema.extend({
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64),
  clientSubmissionId:clientSubmissionIdSchema
});

export type ClaimNicknameInput = z.infer<typeof claimNicknameSchema>;

export const numberCreateRoomSchema=heartbeatSchema.extend({
  password:roomPasswordSchema,
  gradeLevel:gradeLevelSchema
});
export const numberJoinRoomSchema=heartbeatSchema.extend({
  code:roomCodeSchema,
  password:roomPasswordSchema
});
export const numberRoomActionSchema=heartbeatSchema.extend({
  code:roomCodeSchema
});
export const numberAnswerSchema=numberRoomActionSchema.extend({
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64),
  clientSubmissionId:clientSubmissionIdSchema
});


export const footballCreateRoomSchema=heartbeatSchema.extend({
  password:roomPasswordSchema,
  gradeLevel:gradeLevelSchema
});
export const footballJoinRoomSchema=heartbeatSchema.extend({
  code:roomCodeSchema,
  password:roomPasswordSchema
});
export const footballRoomActionSchema=heartbeatSchema.extend({
  code:roomCodeSchema
});
export const footballAnswerSchema=footballRoomActionSchema.extend({
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64),
  clientSubmissionId:clientSubmissionIdSchema
});
