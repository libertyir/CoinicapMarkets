export class Asset {
  constructor(row) {
    this.id = row.id;
    this.code = row.code;
    this.type = row.asset_type;
    this.name_fa = row.name_fa;
    this.name_en = row.name_en;
    this.enabled = Boolean(row.enabled);
    this.display_order = row.display_order;
  }
}
