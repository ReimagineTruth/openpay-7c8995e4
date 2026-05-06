import React from 'react';
import { cn } from '@/lib/utils';

interface ChartData {
  label: string;
  value: number;
  color?: string;
}

interface ProfessionalChartProps {
  data: ChartData[];
  title?: string;
  subtitle?: string;
  type?: 'line' | 'bar' | 'pie' | 'area';
  className?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  animated?: boolean;
}

export const ProfessionalChart: React.FC<ProfessionalChartProps> = ({
  data,
  title,
  subtitle,
  type = 'line',
  className,
  height = 300,
  showGrid = true,
  showLegend = true,
  animated = true
}) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLineChart = () => {
    return (
      <div className="relative h-full">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 300"
          className="overflow-visible"
        >
          {showGrid && (
            <g className="opacity-20">
              {[...Array(6)].map((_, i) => (
                <line
                  key={i}
                  x1="40"
                  y1={50 + (200 / 5) * i}
                  x2="360"
                  y2={50 + (200 / 5) * i}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeWidth="1"
                />
              ))}
            </g>
          )}

          {/* Area under line */}
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          <path
            d={`M 40 250 ${data.map((point, index) => {
              const x = 40 + (320 / (data.length - 1)) * index;
              const y = 250 - (point.value / maxValue) * 200;
              return `L ${x} ${y}`;
            }).join(' ')} L 360 250 Z`}
            fill="url(#areaGradient)"
          />

          {/* Line */}
          <path
            d={`M 40 250 ${data.map((point, index) => {
              const x = 40 + (320 / (data.length - 1)) * index;
              const y = 250 - (point.value / maxValue) * 200;
              return `L ${x} ${y}`;
            }).join(' ')}`}
            fill="none"
            stroke="rgb(59, 130, 246)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {data.map((point, index) => {
            const x = 40 + (320 / (data.length - 1)) * index;
            const y = 250 - (point.value / maxValue) * 200;
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="white"
                  stroke="rgb(59, 130, 246)"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderBarChart = () => {
    const barWidth = 320 / data.length * 0.6;
    const barSpacing = 320 / data.length * 0.4;

    return (
      <div className="relative h-full">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 300"
          className="overflow-visible"
        >
          {showGrid && (
            <g className="opacity-20">
              {[...Array(6)].map((_, i) => (
                <line
                  key={i}
                  x1="40"
                  y1={50 + (200 / 5) * i}
                  x2="360"
                  y2={50 + (200 / 5) * i}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeWidth="1"
                />
              ))}
            </g>
          )}

          {data.map((item, index) => {
            const barHeight = (item.value / maxValue) * 200;
            const x = 40 + (barWidth + barSpacing) * index + barSpacing / 2;
            const y = 250 - barHeight;

            return (
              <g key={index}>
                <defs>
                  <linearGradient id={`barGradient${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={item.color || 'rgb(59, 130, 246)'} />
                    <stop offset="100%" stopColor={item.color || 'rgb(37, 99, 235)'} />
                  </linearGradient>
                </defs>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={`url(#barGradient${index})`}
                  rx="4"
                  ry="4"
                />
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height="8"
                  fill={item.color || 'rgb(59, 130, 246)'}
                  rx="4"
                  ry="4"
                />
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderPieChart = () => {
    let currentAngle = -90;

    return (
      <div className="relative h-full flex items-center justify-center">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 400 300"
          className="overflow-visible"
        >
          {data.map((item, index) => {
            const sliceAngle = (item.value / total) * 360;
            const nextAngle = currentAngle + sliceAngle;
            const largeArcFlag = sliceAngle > 180 ? 1 : 0;

            const x1 = 200 + Math.cos((currentAngle * Math.PI) / 180) * 100;
            const y1 = 150 + Math.sin((currentAngle * Math.PI) / 180) * 100;
            const x2 = 200 + Math.cos((nextAngle * Math.PI) / 180) * 100;
            const y2 = 150 + Math.sin((nextAngle * Math.PI) / 180) * 100;

            const pathData = [
              `M 200 150`,
              `L ${x1} ${y1}`,
              `A 100 100 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ');

            const labelAngle = currentAngle + sliceAngle / 2;
            const labelX = 200 + Math.cos((labelAngle * Math.PI) / 180) * 70;
            const labelY = 150 + Math.sin((labelAngle * Math.PI) / 180) * 70;

            currentAngle = nextAngle;

            return (
              <g key={index}>
                <path
                  d={pathData}
                  fill={item.color || `hsl(${index * 360 / data.length}, 70%, 60%)`}
                  stroke="white"
                  strokeWidth="2"
                  className="transition-all duration-300 hover:opacity-80"
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {`${((item.value / total) * 100).toFixed(1)}%`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return renderLineChart();
      case 'bar':
        return renderBarChart();
      case 'pie':
        return renderPieChart();
      case 'area':
        return renderLineChart(); // Area chart uses same rendering as line
      default:
        return renderLineChart();
    }
  };

  return (
    <div className={cn('premium-card p-6', className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className="relative" style={{ height: `${height}px` }}>
        {renderChart()}
      </div>

      {showLegend && type === 'pie' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color || `hsl(${index * 360 / data.length}, 70%, 60%)` }}
              />
              <span className="text-xs text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfessionalChart;
