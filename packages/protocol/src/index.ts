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
const carModelSchema=z.enum(["esportivo","sedan","hatch","suv","picape","buggy","formula","classico","jipe","van"]);
const carColorSchema=z.string().regex(/^#[0-9a-fA-F]{6}$/);
const crazyCarSelection={carModel:carModelSchema.optional(),carColor:carColorSchema.optional()};
export const crazyCreateRoomSchema=crazyAuthSchema.extend(crazyCarSelection);
export const crazyJoinRoomSchema=crazyAuthSchema.extend({
  code:roomCodeSchema,
  pin:z.string().regex(/^\d{3}$/),
  ...crazyCarSelection
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
export const crazyTrackAnswerSchema=crazyBombAnswerSchema;

export type ClaimNicknameInput = z.infer<typeof claimNicknameSchema>;

export const numberCarChoiceSchema=z.object({
  modelId:z.enum(["compacto","esportivo","picape","suv","conversivel","formula","classico","rally","van","supercarro"]),
  color:carColorSchema
});
export type NumberCarChoice=z.infer<typeof numberCarChoiceSchema>;
export const numberCreateRoomSchema=heartbeatSchema.extend({
  password:roomPasswordSchema,
  gradeLevel:gradeLevelSchema,
  carChoice:numberCarChoiceSchema.optional()
});
export const numberJoinRoomSchema=heartbeatSchema.extend({
  code:roomCodeSchema,
  password:roomPasswordSchema,
  carChoice:numberCarChoiceSchema.optional()
});
export const numberRoomActionSchema=heartbeatSchema.extend({
  code:roomCodeSchema,
  carChoice:numberCarChoiceSchema.optional()
});
export const numberAnswerSchema=numberRoomActionSchema.extend({
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64),
  clientSubmissionId:clientSubmissionIdSchema
});


const footballPinSchema=z.string().regex(/^\d{3}$/);
export const footballCreateRoomSchema=heartbeatSchema.extend({
  password:footballPinSchema,
  gradeLevel:gradeLevelSchema
});
export const footballJoinRoomSchema=heartbeatSchema.extend({
  code:roomCodeSchema,
  password:footballPinSchema
});
export const footballRoomActionSchema=heartbeatSchema.extend({
  code:roomCodeSchema
});
export const footballAnswerSchema=footballRoomActionSchema.extend({
  target:z.number().int().min(0).max(8),
  questionId:z.string().min(3).max(160),
  answer:z.string().min(1).max(64),
  clientSubmissionId:clientSubmissionIdSchema
});

export const propertyCreateRoomSchema=heartbeatSchema.extend({
  pin:z.string().regex(/^\d{3}$/),
  mode:z.enum(["short","full"]),
  shortRounds:z.number().int().min(4).max(16)
});
export const propertyJoinRoomSchema=heartbeatSchema.extend({
  code:roomCodeSchema,
  pin:z.string().regex(/^\d{3}$/)
});
export const propertyRoomActionSchema=heartbeatSchema.extend({code:roomCodeSchema});
export const propertyGameActionSchema=propertyRoomActionSchema.extend({
  action:z.enum(["roll","answer","buy","end","upgrade","sell"]),
  questionId:z.string().max(160).optional(),
  answer:z.string().max(64).optional(),
  submissionId:clientSubmissionIdSchema.optional(),
  buy:z.boolean().optional(),
  spaceIndex:z.number().int().min(0).max(35).optional()
});
