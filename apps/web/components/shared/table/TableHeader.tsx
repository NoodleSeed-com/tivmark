const theadClass = 'bg-ui-surface-muted text-xs uppercase text-ui-heading';
const trHeadClass = 'hover:bg-gray-50';
const thClass = 'px-6 py-3';

export const TableHeader = ({ cols }: { cols: string[] }) => {
  return (
    <thead className={theadClass}>
      <tr className={trHeadClass}>
        {cols.map((col, index) => (
          <th key={index} scope="col" className={thClass}>
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
};
