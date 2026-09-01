import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const TogglePasswordVisibility = ({
  isPasswordVisible,
  handlePasswordVisibility,
}) => {
  return (
    <button
      onClick={handlePasswordVisibility}
      className="pointer absolute right-3 top-[50px] flex items-center text-ui-heading"
      type="button"
      aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
      aria-pressed={isPasswordVisible}
      title={isPasswordVisible ? 'Hide password' : 'Show password'}
    >
      {!isPasswordVisible ? (
        <EyeIcon className="h-6 w-4 text-ui-heading" />
      ) : (
        <EyeSlashIcon className="h-6 w-4 text-ui-heading" />
      )}
    </button>
  );
};

export default TogglePasswordVisibility;
