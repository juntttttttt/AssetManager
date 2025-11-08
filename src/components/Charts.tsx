import { useMemo } from 'react'

interface BarChartProps {
  data: Array<{ date?: string; label?: string; count?: number; value?: number; accepted?: number; declined?: number }>
  height?: number
  showStacked?: boolean
}

export function BarChart({ data, height = 200, showStacked = false }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No data available</p>
      </div>
    )
  }

  const maxValue = useMemo(() => {
    if (showStacked && data.length > 0 && 'accepted' in data[0] && 'declined' in data[0]) {
      return Math.max(...data.map((d) => (d.accepted || 0) + (d.declined || 0)), 1)
    }
    return Math.max(...data.map((d) => d.count || d.value || 0), 1)
  }, [data, showStacked])

  const chartWidth = 800
  const chartHeight = height
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom
  const barWidth = innerWidth / Math.max(data.length, 1)

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width={chartWidth} height={chartHeight} style={{ display: 'block' }}>
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + innerHeight}
          stroke="var(--border)"
          strokeWidth="2"
        />
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={padding.left + innerWidth}
          y2={padding.top + innerHeight}
          stroke="var(--border)"
          strokeWidth="2"
        />
        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = Math.round(maxValue * ratio)
          const y = padding.top + innerHeight - innerHeight * ratio
          return (
            <g key={ratio}>
              <line
                x1={padding.left - 5}
                y1={y}
                x2={padding.left}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-muted)"
              >
                {value}
              </text>
            </g>
          )
        })}
        {/* Bars */}
        {data.map((d, index) => {
          const x = padding.left + index * barWidth + barWidth * 0.1
          const barW = barWidth * 0.8
          
          if (showStacked && 'accepted' in d && 'declined' in d) {
            const acceptedHeight = ((d.accepted || 0) / maxValue) * innerHeight
            const declinedHeight = ((d.declined || 0) / maxValue) * innerHeight
            const acceptedY = padding.top + innerHeight - acceptedHeight - declinedHeight
            const declinedY = padding.top + innerHeight - declinedHeight
            
            return (
              <g key={index}>
                <rect
                  x={x}
                  y={acceptedY}
                  width={barW}
                  height={acceptedHeight}
                  fill="var(--success)"
                  rx="2"
                />
                <rect
                  x={x}
                  y={declinedY}
                  width={barW}
                  height={declinedHeight}
                  fill="var(--danger)"
                  rx="2"
                />
                {/* Date label */}
                {index % Math.ceil(data.length / 10) === 0 && (
                  <text
                    x={x + barW / 2}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--text-muted)"
                    transform={`rotate(-45, ${x + barW / 2}, ${chartHeight - 10})`}
                  >
                    {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </text>
                )}
              </g>
            )
          } else {
            const value = d.count || d.value || 0
            const barHeight = (value / maxValue) * innerHeight
            const y = padding.top + innerHeight - barHeight
            const label = d.label || (d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
            
            return (
              <g key={index}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barHeight}
                  fill="var(--accent)"
                  rx="2"
                />
                {/* Label */}
                {index % Math.ceil(data.length / 10) === 0 && label && (
                  <text
                    x={x + barW / 2}
                    y={chartHeight - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--text-muted)"
                    transform={d.date ? `rotate(-45, ${x + barW / 2}, ${chartHeight - 10})` : undefined}
                  >
                    {label}
                  </text>
                )}
              </g>
            )
          }
        })}
      </svg>
    </div>
  )
}

interface LineChartProps {
  data: Array<{ week: string; rate: number } | { month: string; rate: number }>
  height?: number
  label?: string
}

export function LineChart({ data, height = 200, label = 'Success Rate (%)' }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No data available</p>
      </div>
    )
  }

  const maxValue = 100
  const minValue = 0
  const valueRange = maxValue - minValue

  const chartWidth = 800
  const chartHeight = height
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  const points = data.map((d, index) => {
    const x = padding.left + (index / (data.length - 1 || 1)) * innerWidth
    const y = padding.top + innerHeight - ((d.rate - minValue) / valueRange) * innerHeight
    return { x, y, value: d.rate }
  })

  const pathData = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ')

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width={chartWidth} height={chartHeight} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((value) => {
          const y = padding.top + innerHeight - ((value - minValue) / valueRange) * innerHeight
          return (
            <g key={value}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + innerWidth}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.5"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--text-muted)"
              >
                {value}%
              </text>
            </g>
          )
        })}
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + innerHeight}
          stroke="var(--border)"
          strokeWidth="2"
        />
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={padding.left + innerWidth}
          y2={padding.top + innerHeight}
          stroke="var(--border)"
          strokeWidth="2"
        />
        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Points */}
        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="var(--accent)"
              stroke="var(--bg-secondary)"
              strokeWidth="2"
            />
            {/* Label */}
            {index % Math.ceil(data.length / 8) === 0 && (
              <text
                x={point.x}
                y={chartHeight - 10}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {'week' in data[index] ? data[index].week : data[index].month}
              </text>
            )}
          </g>
        ))}
        {/* Y-axis label */}
        <text
          x={15}
          y={chartHeight / 2}
          textAnchor="middle"
          fontSize="12"
          fill="var(--text-muted)"
          transform={`rotate(-90, 15, ${chartHeight / 2})`}
        >
          {label}
        </text>
      </svg>
    </div>
  )
}

interface DonutChartProps {
  data: Array<{ label: string; value: number; color: string }>
  size?: number
}

export function DonutChart({ data, size = 200 }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  
  if (total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No data</p>
        </div>
      </div>
    )
  }

  const radius = size / 2 - 10
  const centerX = size / 2
  const centerY = size / 2
  const strokeWidth = 30

  let currentAngle = -90 // Start from top

  const segments = data
    .filter((item) => item.value > 0)
    .map((item) => {
      const percentage = (item.value / total) * 100
      const angle = (percentage / 100) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      currentAngle = endAngle

      const startAngleRad = (startAngle * Math.PI) / 180
      const endAngleRad = (endAngle * Math.PI) / 180

      const x1 = centerX + radius * Math.cos(startAngleRad)
      const y1 = centerY + radius * Math.sin(startAngleRad)
      const x2 = centerX + radius * Math.cos(endAngleRad)
      const y2 = centerY + radius * Math.sin(endAngleRad)

      const largeArcFlag = angle > 180 ? 1 : 0

      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ')

      return { ...item, pathData, percentage, startAngle, endAngle }
    })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ display: 'block' }}>
        {segments.map((segment, index) => (
          <path
            key={index}
            d={segment.pathData}
            fill={segment.color}
            opacity="0.8"
          />
        ))}
        {/* Center text */}
        <text
          x={centerX}
          y={centerY - 5}
          textAnchor="middle"
          fontSize="20"
          fontWeight="600"
          fill="var(--text-primary)"
        >
          {total}
        </text>
        <text
          x={centerX}
          y={centerY + 15}
          textAnchor="middle"
          fontSize="12"
          fill="var(--text-muted)"
        >
          Total
        </text>
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {segments.map((segment, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                background: segment.color,
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              {segment.label}: {segment.value} ({segment.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

