// Order tickets shown along the top of the screen.

export class OrderManager {
  constructor(game) {
    this.game = game;
    this.tickets = [];
    this.nextId = 1;
  }

  add(customer) {
    const t = {
      id: this.nextId++,
      dish: customer.order,
      customer,
      table: customer.window ? 'DT' : customer.table ? customer.table.number : '?',
      critic: customer.critic,
      vip: !!customer.vip,
      created: this.game.time,
      state: 'open',
    };
    this.tickets.push(t);
    customer.ticket = t;
    this.game.events.emit('ticket:add', t);
    return t;
  }

  complete(t) {
    if (!t || t.state !== 'open') return;
    t.state = 'done';
    this.tickets = this.tickets.filter((x) => x !== t);
    this.game.events.emit('ticket:done', t);
  }

  fail(t) {
    if (!t || t.state !== 'open') return;
    t.state = 'failed';
    this.tickets = this.tickets.filter((x) => x !== t);
    this.game.events.emit('ticket:fail', t);
  }

  clear() {
    this.tickets = [];
    this.game.events.emit('ticket:clear');
  }
}
