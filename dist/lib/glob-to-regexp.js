const translate = (glob) => {
    if (glob.length === 0)
        return '';
    if (glob.startsWith('**/'))
        return `(?:.*/)?${translate(glob.slice(3))}`;
    if (glob.startsWith('**'))
        return `.*${translate(glob.slice(2))}`;
    if (glob.startsWith('*'))
        return `[^/]*${translate(glob.slice(1))}`;
    if (glob.startsWith('?'))
        return `[^/]${translate(glob.slice(1))}`;
    const close = glob.indexOf('}');
    if (glob.startsWith('{') && close > 0) {
        const alternatives = glob.slice(1, close).split(',').map(translate);
        return `(?:${alternatives.join('|')})${translate(glob.slice(close + 1))}`;
    }
    return `${glob[0]?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${translate(glob.slice(1))}`;
};
export const globToRegExp = (glob) => new RegExp(`^${translate(glob.replace(/^\.\//, ''))}$`);
//# sourceMappingURL=glob-to-regexp.js.map