UPDATE webhook_configs SET webhook_url = 'https://app.iautomatize.me/api/iwh/8e10a4bf47804b27165478884c3afafe' WHERE page_slug = 'vhs_ao_prompt';

UPDATE leads SET webhook_sent = true, webhook_sent_at = now() WHERE id IN ('4fa97d5d-109b-4f2f-bfd2-8baa1678a0d7', '28e8de9c-9ac5-4754-b3d7-590ba59a3f1b');