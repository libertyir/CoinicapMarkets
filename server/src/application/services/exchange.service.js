export class ExchangeService {
  constructor(repository) { this.repository = repository; }
  list() { return this.repository.listEnabled(); }
}
