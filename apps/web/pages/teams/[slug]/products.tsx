import type { GetServerSidePropsContext } from 'next';

const ProductsRedirect = () => null;

export const getServerSideProps = ({ params }: GetServerSidePropsContext) => ({
  redirect: {
    destination: `/teams/${params?.slug}/time-off`,
    permanent: false,
  },
});

export default ProductsRedirect;
