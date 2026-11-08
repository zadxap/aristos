import { t } from '../lib/i18n';

interface Props {
  issues: string[];
}

export default function ValidationList({ issues }: Props) {
  const tr = t().validation;
  if (issues.length === 0) {
    return <div className="validation ok">{tr.ok}</div>;
  }
  return (
    <div className="validation bad">
      <div className="validation-title">{tr.errorsTitle(issues.length)}</div>
      <ul>
        {issues.map((issue, i) => (
          <li key={i}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}
