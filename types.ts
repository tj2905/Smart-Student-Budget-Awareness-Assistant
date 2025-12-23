
export enum Category {
  FOOD = 'Food & Drinks',
  TRANSPORT = 'Transport',
  BOOKS = 'Books & Study',
  ENTERTAINMENT = 'Entertainment',
  RENT = 'Rent & Utilities',
  OTHER = 'Other'
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
  VIOLET = 'violet'
}

export interface Expense {
  id: string;
  amount: number;
  category: Category | string;
  note: string;
  timestamp: string;
}

export interface Budget {
  monthlyLimit: number;
}

export interface AppState {
  expenses: Expense[];
  budget: Budget;
}

export interface CLILine {
  text: string;
  type: 'input' | 'output' | 'error' | 'success';
}

export interface FilterState {
  query: string;
  category: string;
}
