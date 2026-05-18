/**
 * Utilitário para converter a query string de campos num objeto 'select' do Prisma.
 * Exemplo de query: ?fields=id,name,price
 * Resultado Prisma: { id: true, name: true, price: true }
 */
export function getSelectFields(query: { fields?: unknown }): Record<string, boolean> | undefined {
    const fieldsRaw = query.fields as string;
    
    if (!fieldsRaw || typeof fieldsRaw !== 'string') {
        return undefined;
    }

    const fieldsArray = fieldsRaw.split(',').map(f => f.trim()).filter(Boolean);
    
    if (fieldsArray.length === 0) {
        return undefined;
    }

    const selectObj: Record<string, boolean> = {};
    fieldsArray.forEach(field => {
        // Simple top-level field selection.
        // Complex relations (like user.profile.name) could be parsed but we stick to basics for now.
        if (field) {
            selectObj[field] = true;
        }
    });

    return selectObj;
}
