function capitalize(value) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function commandUsage(prefix, name, usage = "") {
  return usage ? `${prefix}${name} ${usage}`.trim() : `${prefix}${name}`;
}

module.exports = {
  capitalize,
  chunk,
  commandUsage,
};
