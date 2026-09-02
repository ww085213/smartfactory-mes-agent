export class AppError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

export const assertFound = (value, message = '数据不存在') => {
  if (!value) throw new AppError(message, 404)
  return value
}
