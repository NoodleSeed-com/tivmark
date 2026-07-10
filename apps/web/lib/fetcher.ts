const fetcher = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json.error?.message ||
        json.detail ||
        'An error occurred while fetching the data'
    );
  }

  return json;
};

export default fetcher;
