import { AppError } from "../utils/AppError.js";

export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(new AppError(result.error.issues.map((issue) => issue.message).join(", "), 400));
  }
  req.body = result.data;
  next();
};
