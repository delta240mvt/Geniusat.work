export class BudgetExceededError extends Error {
  constructor(
    public readonly requestedCredits: number,
    public readonly remainingCredits: number,
  ) {
    super(`Budget exceeded: requested ${requestedCredits}, remaining ${remainingCredits}.`);
    this.name = 'BudgetExceededError';
  }
}

export interface BudgetSnapshot {
  maxCredits: number;
  spentCredits: number;
  reservedCredits: number;
  remainingCredits: number;
}

export class BudgetLedger {
  private spentCredits = 0;
  private readonly reservations = new Map<string, number[]>();

  constructor(private readonly maxCredits: number) {
    if (!Number.isInteger(maxCredits) || maxCredits < 0) {
      throw new Error('Budget maxCredits must be a non-negative integer.');
    }
  }

  reserve(kind: string, credits: number): void {
    this.assertCredits(credits);
    if (credits > this.remaining()) {
      throw new BudgetExceededError(credits, this.remaining());
    }

    const entries = this.reservations.get(kind) ?? [];
    entries.push(credits);
    this.reservations.set(kind, entries);
  }

  commit(kind: string, actualCredits: number): void {
    this.assertCredits(actualCredits);
    const entries = this.reservations.get(kind) ?? [];
    const reserved = entries[0] ?? 0;
    const otherReserved = this.reserved() - reserved;
    if (actualCredits > this.maxCredits - this.spentCredits - otherReserved) {
      throw new BudgetExceededError(actualCredits, this.maxCredits - this.spentCredits - otherReserved);
    }

    entries.shift();
    if (entries.length === 0) this.reservations.delete(kind);

    this.spentCredits += actualCredits;
  }

  release(kind: string): void {
    const entries = this.reservations.get(kind) ?? [];
    entries.shift();
    if (entries.length === 0) {
      this.reservations.delete(kind);
    }
  }

  spent(): number {
    return this.spentCredits;
  }

  reserved(): number {
    return [...this.reservations.values()].flat().reduce((total, value) => total + value, 0);
  }

  remaining(): number {
    return this.maxCredits - this.spentCredits - this.reserved();
  }

  snapshot(): BudgetSnapshot {
    return {
      maxCredits: this.maxCredits,
      spentCredits: this.spentCredits,
      reservedCredits: this.reserved(),
      remainingCredits: this.remaining(),
    };
  }

  private assertCredits(credits: number): void {
    if (!Number.isInteger(credits) || credits < 0) {
      throw new Error('Credit amounts must be non-negative integers.');
    }
  }
}
