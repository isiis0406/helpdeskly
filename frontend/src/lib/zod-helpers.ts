import { z } from 'zod'

// Maps empty string to undefined to simplify optional string fields
export const emptyToUndefined = () =>
  z.preprocess((val) => (val === '' ? undefined : val), z.string().optional())

