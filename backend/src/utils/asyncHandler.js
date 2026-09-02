/**
 * Evita try/catch repetido em cada controller.
 * Encaminha qualquer erro para o errorHandler global.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
