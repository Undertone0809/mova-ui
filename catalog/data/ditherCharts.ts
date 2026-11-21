import { getInstallCommand } from './installCommand';
export interface DitherChartItem {
  id: string;
  label: string;
  kebabName: string;
  category: string;
  description: string;
  cliCommand: string;
  codeSnippet: string;
}

export type SimpleCompItem = DitherChartItem;

export const ditherChartsData: DitherChartItem[] = [
  {
    id: 'dither-donut',
    label: 'Dither Donut Graph',
    kebabName: 'dither-donut',
    category: 'donut',
    description: 'Canvas dithered donut graph with white particle highlights & period selectors.',
    cliCommand: getInstallCommand('dither-donut'),
    codeSnippet: `import { DitherDonutChart } from '@mova-ui/react/catalog/components/dither-charts/DitherDonutChart';\n\nexport default function Demo() {\n  return <DitherDonutChart theme="dark" />;\n}`
  },
  {
    id: 'dither-stacked',
    label: 'Dither Stacked Bar',
    kebabName: 'dither-stacked',
    category: 'bar',
    description: 'Stacked canvas bar graph with regional branch hovers & white dither bands.',
    cliCommand: getInstallCommand('dither-stacked'),
    codeSnippet: `import { DitherStackedChart } from '@mova-ui/react/catalog/components/dither-charts/DitherStackedChart';\n\nexport default function Demo() {\n  return <DitherStackedChart theme="dark" />;\n}`
  },
  {
    id: 'dither-growth',
    label: 'Dither Area Growth',
    kebabName: 'dither-growth',
    category: 'area',
    description: 'Canvas area growth line graph with white dither tiles & date scrubber cursor.',
    cliCommand: getInstallCommand('dither-growth'),
    codeSnippet: `import { DitherGrowthChart } from '@mova-ui/react/catalog/components/dither-charts/DitherGrowthChart';\n\nexport default function Demo() {\n  return <DitherGrowthChart theme="dark" />;\n}`
  },
  {
    id: 'dither-heatmap',
    label: 'Activity Dither Heatmap',
    kebabName: 'dither-heatmap',
    category: 'matrix',
    description: 'Activity heatmap grid with white dither intensity tiles.',
    cliCommand: getInstallCommand('dither-heatmap'),
    codeSnippet: `import { ActivityHeatmap } from '@mova-ui/react/catalog/components/dither-charts/ActivityHeatmap';\n\nexport default function Demo() {\n  return <ActivityHeatmap theme="dark" />;\n}`
  },
  {
    id: 'dither-gauge',
    label: 'Server CPU Gauge',
    kebabName: 'dither-gauge',
    category: 'radial',
    description: 'Server CPU & memory radial gauge dial with white dither dot matrix.',
    cliCommand: getInstallCommand('dither-gauge'),
    codeSnippet: `import { ServerGauge } from '@mova-ui/react/catalog/components/dither-charts/ServerGauge';\n\nexport default function Demo() {\n  return <ServerGauge theme="dark" />;\n}`
  },
  {
    id: 'dither-traffic',
    label: 'Traffic Scatter Bubbles',
    kebabName: 'dither-traffic',
    category: 'scatter',
    description: 'Traffic source scatter bubble plot with floating white dither nodes.',
    cliCommand: getInstallCommand('dither-traffic'),
    codeSnippet: `import { TrafficBubble } from '@mova-ui/react/catalog/components/dither-charts/TrafficBubble';\n\nexport default function Demo() {\n  return <TrafficBubble theme="dark" />;\n}`
  },
  {
    id: 'dither-funnel',
    label: 'Conversion Funnel',
    kebabName: 'dither-funnel',
    category: 'bar',
    description: 'Conversion funnel with white dither progress stage bars.',
    cliCommand: getInstallCommand('dither-funnel'),
    codeSnippet: `import { DitherFunnelChart } from '@mova-ui/react/catalog/components/dither-charts/DitherFunnelChart';\n\nexport default function Demo() {\n  return <DitherFunnelChart theme="dark" />;\n}`
  },
  {
    id: 'dither-device',
    label: 'Device Usage Donut',
    kebabName: 'dither-device',
    category: 'donut',
    description: 'Device usage donut chart with white dither particle segments.',
    cliCommand: getInstallCommand('dither-device'),
    codeSnippet: `import { DeviceUsageChart } from '@mova-ui/react/catalog/components/dither-charts/DeviceUsageChart';\n\nexport default function Demo() {\n  return <DeviceUsageChart theme="dark" />;\n}`
  },
  {
    id: 'dither-storage',
    label: 'Storage Capacity Bar',
    kebabName: 'dither-storage',
    category: 'bar',
    description: 'Storage capacity bar with animated white dither progress shaders.',
    cliCommand: getInstallCommand('dither-storage'),
    codeSnippet: `import { StorageUsageChart } from '@mova-ui/react/catalog/components/dither-charts/StorageUsageChart';\n\nexport default function Demo() {\n  return <StorageUsageChart theme="dark" />;\n}`
  },
  {
    id: 'dither-revenue',
    label: 'Revenue Spline Line',
    kebabName: 'dither-revenue',
    category: 'line',
    description: 'Revenue line graph with white dither gradient fill.',
    cliCommand: getInstallCommand('dither-revenue'),
    codeSnippet: `import { RevenueLineChart } from '@mova-ui/react/catalog/components/dither-charts/RevenueLineChart';\n\nexport default function Demo() {\n  return <RevenueLineChart theme="dark" />;\n}`
  },
  {
    id: 'dither-uptime',
    label: 'System Uptime Matrix',
    kebabName: 'dither-uptime',
    category: 'matrix',
    description: '90-day system uptime matrix with white dither status tiles.',
    cliCommand: getInstallCommand('dither-uptime'),
    codeSnippet: `import { UptimeChart } from '@mova-ui/react/catalog/components/dither-charts/UptimeChart';\n\nexport default function Demo() {\n  return <UptimeChart theme="dark" />;\n}`
  }
];

export const simpleCompData = ditherChartsData;
