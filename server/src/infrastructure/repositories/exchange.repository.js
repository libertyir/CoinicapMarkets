import { Exchange } from "../../domain/entities/exchange.js";

export class ExchangeRepository {
  constructor(db) { this.db = db; }

  async listEnabled() {
    const result = await this.db.prepare(`
      SELECT e.code, e.name, e.name_fa, e.name_en, e.exchange_type, e.enabled,
             e.description_fa, e.description_en, e.website_url, e.documentation_url,
             e.support_url, e.support_email, e.status_page_url, e.logo_url,
             e.country_code, e.display_order,
             (SELECT json_group_array(json_object(
               'type', c.contact_type, 'label_fa', c.label_fa,
               'label_en', c.label_en, 'value', c.value
             )) FROM exchange_contacts c
             WHERE c.exchange_id=e.id AND c.is_public=1) AS contacts_json
      FROM exchanges e WHERE e.enabled=1 ORDER BY e.display_order, e.code
    `).all();
    return result.results.map((row) => new Exchange({
      ...row, contacts: JSON.parse(row.contacts_json || "[]"),
    }));
  }
}
