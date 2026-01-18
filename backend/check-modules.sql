SELECT cm.module_code, cm.is_active 
FROM company_modules cm 
JOIN companies c ON cm.company_id = c.id 
WHERE c.name = 'Miranda Comercial';
