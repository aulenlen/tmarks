/**
 * Toggle 开关组件
 * 修复开关按钮颜色显示问题
 */

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
}

export function Toggle({ checked, onChange, disabled = false, label, description }: ToggleProps) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div 
        className={`
          w-11 h-6 rounded-full transition-colors duration-200 ease-in-out
          relative
          ${checked ? 'bg-primary' : 'bg-muted'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20
        `}
      >
        <div
          className={`
            absolute top-[2px] left-[2px]
            w-5 h-5 rounded-full
            bg-background border border-border
            transition-transform duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </div>
      {(label || description) && (
        <div className="ml-3">
          {label && <div className="text-sm font-medium text-foreground">{label}</div>}
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
      )}
    </label>
  )
}
