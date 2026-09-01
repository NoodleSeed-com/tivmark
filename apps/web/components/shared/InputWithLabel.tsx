import { Input, InputProps } from 'react-daisyui';

interface InputWithLabelProps extends InputProps {
  label: string | React.ReactNode;
  error?: string;
  descriptionText?: string;
}

const InputWithLabel = (props: InputWithLabelProps) => {
  const { label, error, descriptionText, ...rest } = props;

  const classes = [
    'text-sm border-ui-border bg-ui-surface text-ui-text placeholder:text-ui-muted focus:border-ui-accent',
  ];

  if (error) {
    classes.push('input-error');
  }

  return (
    <div className="form-control w-full">
      {typeof label === 'string' ? (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      ) : (
        label
      )}
      <Input className={classes.join(' ')} {...rest} />
      {(error || descriptionText) && (
        <label className="label">
          <span className={`label-text-alt ${error ? 'text-error' : ''}`}>
            {error || descriptionText}
          </span>
        </label>
      )}
    </div>
  );
};

export default InputWithLabel;
