export const renderPromptTemplate = (
  template: string,
  variables: Record<string, string | number | undefined>,
) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];

    return value === undefined ? '' : String(value);
  });
