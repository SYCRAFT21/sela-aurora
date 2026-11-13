export const sender = (raw: string) => {
    const match = /^(.*?)\s*<([^<>]+)>\s*$/.exec(raw || '');
    return { name: match?.[1]?.replace(/^"(.*)"$/, '$1') || raw || 'Pengirim', address: match?.[2] || raw || '' };
};
export const mailboxes = (raw: string) => (raw.match(/(?:"(?:[^"\\]|\\.)*"|<[^>]*>|[^,"<])+/g) || []).map(value => sender(value.trim()).address.trim()).filter(Boolean);
export const destination = (endpoint: string) => { try {
    return new URL(endpoint).origin;
}
catch {
    return 'URL API belum valid';
} };
