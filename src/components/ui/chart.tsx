import * as React from 'react';
import { ResponsiveContainer } from 'recharts';

import { cn } from '@/lib/utils';

interface ChartConfig {
  colors: string[];
  tooltipDisabled?: boolean;
  gridDisabled?: boolean;
  yAxisDisabled?: boolean;
  xAxisDisabled?: boolean;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
  labelFormatter?: (label: string) => string;
  labelClassName?: string;
  formatter?: (value: number) => string | number;
}

interface ChartTooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  hideLabel?: boolean;
  hideIndicator?: boolean;
  payload?: TooltipProps['payload'];
  active?: boolean;
  label?: string;
  labelClassName?: string;
}

interface LegendPayloadItem {
  value: string;
  type: string;
  id: string;
  color: string;
  [key: string]: string;
}

interface ChartLegendProps extends React.HTMLAttributes<HTMLDivElement> {
  payload?: LegendPayloadItem[];
  verticalAlign?: 'top' | 'middle' | 'bottom';
  hideIcon?: boolean;
  nameKey?: string;
}

const ChartContext = React.createContext<ChartConfig>({
  colors: [],
});

const Chart = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ReactElement;
  }
>(({ id, className, children, config, ...props }, ref) => {
  const chartId = React.useId();

  return (
    <ChartContext.Provider value={config}>
      <div
        ref={ref}
        className={cn('w-full h-[350px]', className)}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <ResponsiveContainer>
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
Chart.displayName = 'Chart';

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipProps
>(({
  className,
  payload,
  active,
  label,
  labelClassName,
  hideLabel = false,
  hideIndicator = false,
  ...props
}, ref) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border bg-background p-2 shadow-md',
        className
      )}
      {...props}
    >
      {!hideLabel && (
        <div className={cn('mb-1 text-sm font-medium', labelClassName)}>
          {label}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {payload.map((item, index: number) => (
          <div
            key={`item-${index}`}
            className="flex items-center gap-2 text-sm"
          >
            {!hideIndicator && (
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className="font-medium">{item.value}</span>
            <span className="text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = 'ChartTooltipContent';

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendProps
>(({
  className,
  payload,
  verticalAlign = 'middle',
  hideIcon = false,
  nameKey = 'name',
  ...props
}, ref) => {
  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-2',
        {
          'justify-start': verticalAlign === 'top',
          'justify-center': verticalAlign === 'middle',
          'justify-end': verticalAlign === 'bottom',
        },
        className
      )}
      {...props}
    >
      {payload.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 text-sm"
        >
          {!hideIcon && (
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span>{item[nameKey]}</span>
        </div>
      ))}
    </div>
  );
});
ChartLegendContent.displayName = 'ChartLegendContent';

const ChartStyle = ({
  id,
  config,
}: {
  id: string;
  config: ChartConfig;
}) => {
  const { colors, gridDisabled, yAxisDisabled, xAxisDisabled } = config;

  return (
    <style>
      {`
      #${id} .recharts-cartesian-grid-horizontal line,
      #${id} .recharts-cartesian-grid-vertical line {
        ${gridDisabled ? 'display: none;' : 'stroke: var(--border);'}
      }

      #${id} .recharts-yAxis .recharts-cartesian-axis-line,
      #${id} .recharts-xAxis .recharts-cartesian-axis-line {
        display: none;
      }

      #${id} .recharts-yAxis .recharts-cartesian-axis-tick-line,
      #${id} .recharts-xAxis .recharts-cartesian-axis-tick-line {
        display: none;
      }

      #${id} .recharts-yAxis .recharts-cartesian-axis-tick-value,
      #${id} .recharts-xAxis .recharts-cartesian-axis-tick-value {
        color: var(--muted-foreground);
        font-size: 12px;
        font-weight: 400;
      }

      #${id} .recharts-yAxis {
        ${yAxisDisabled ? 'display: none;' : ''}
      }

      #${id} .recharts-xAxis {
        ${xAxisDisabled ? 'display: none;' : ''}
      }

      ${colors.map(
        (color, index) => `
        #${id} .recharts-bar-rectangle:nth-of-type(${index + 1}) path {
          fill: ${color};
        }
      `
      )}
    `}
    </style>
  );
};

export {
  Chart,
  ChartTooltipContent as ChartTooltip,
  ChartLegendContent as ChartLegend,
};
