export async function onRootCall(options = {}) {
  const response = await fetch("/api", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  const json = await response.json();
  console.log(json);
  return json;
}
