import type { GetServerSidePropsContext } from 'next';

const LoginRedirect = () => null;

export const getServerSideProps = ({ query }: GetServerSidePropsContext) => {
  const params = new URLSearchParams({ tab: 'login' });

  for (const [key, value] of Object.entries(query)) {
    if (key !== 'tab' && typeof value === 'string') {
      params.set(key, value);
    }
  }

  return {
    redirect: {
      destination: `/?${params.toString()}`,
      permanent: false,
    },
  };
};

export default LoginRedirect;
