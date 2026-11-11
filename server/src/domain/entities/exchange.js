export class Exchange {
  constructor(row) {
    this.code = row.code;
    this.name = row.name;
    this.name_fa = row.name_fa;
    this.name_en = row.name_en;
    this.exchange_type = row.exchange_type;
    this.enabled = Boolean(row.enabled);
    this.description_fa = row.description_fa;
    this.description_en = row.description_en;
    this.website_url = row.website_url;
    this.documentation_url = row.documentation_url;
    this.support_url = row.support_url;
    this.support_email = row.support_email;
    this.status_page_url = row.status_page_url;
    this.logo_url = row.logo_url;
    this.country_code = row.country_code;
    this.display_order = row.display_order;
    this.contacts = row.contacts || [];
  }
}
