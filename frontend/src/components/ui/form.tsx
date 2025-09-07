import * as React from 'react'
import { Controller, FormProvider, useFormContext } from 'react-hook-form'
import { cn } from '@/lib/utils'

export function Form({ children, ...props }: React.ComponentProps<typeof FormProvider>) {
  return <FormProvider {...props}>{children}</FormProvider>
}

export function FormField({ name, render }: { name: string; render: (field: any) => React.ReactNode }) {
  const methods = useFormContext()
  return (
    <Controller
      name={name as any}
      control={methods.control}
      render={({ field }) => <>{render(field)}</>}
    />
  )
}

export function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-1', className)} {...props} />
}

export function FormLabel({ className, ...props }: React.HTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm', className)} {...props} />
}

export function FormControl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />
}

export function FormMessage({ children }: { children?: React.ReactNode }) {
  if (!children) return null
  return <p className="text-sm text-red-600">{children}</p>
}

