export type BankId =
  | 'commbank'
  | 'westpac'
  | 'nab'
  | 'anz'
  | 'ing'
  | 'macquarie'
  | 'bendigo'
  | 'boq'
  | 'stgeorge'
  | 'bankwest'
  | 'suncorp'
  | 'up'
  | 'ubank'
  | 'other';

export type BankConfig = {
  id: BankId;
  name: string;
  /** Official https internet-banking login; empty when unverified or app-only. */
  loginUrl: string;
};

/**
 * Australian retail banks for transaction import. loginUrl values were checked against
 * each bank's own domain (https only, no third-party/ad links). Empty when unverified.
 */
export const BANKS: readonly BankConfig[] = [
  {
    id: 'commbank',
    name: 'CommBank',
    loginUrl: 'https://www.my.commbank.com.au/netbank/Logon/logon.aspx',
  },
  {
    id: 'westpac',
    name: 'Westpac',
    loginUrl:
      'https://banking.westpac.com.au/wbc/banking/handler?TAM_OP=login&segment=personal&logout=false',
  },
  {
    id: 'nab',
    name: 'NAB',
    loginUrl: 'https://ib.nab.com.au/login',
  },
  {
    id: 'anz',
    name: 'ANZ',
    loginUrl: 'https://login.anz.com/internetbanking',
  },
  {
    id: 'ing',
    name: 'ING',
    loginUrl: 'https://www.ing.com.au/securebanking/',
  },
  {
    id: 'macquarie',
    name: 'Macquarie',
    loginUrl: 'https://online.macquarie.com.au/personal/',
  },
  {
    id: 'bendigo',
    name: 'Bendigo',
    loginUrl: 'https://banking.bendigobank.com.au/Logon/login.page',
  },
  {
    id: 'boq',
    name: 'Bank of Queensland',
    loginUrl: 'https://internetbanking.boq.com.au/',
  },
  {
    id: 'stgeorge',
    name: 'St.George',
    loginUrl: 'https://ibanking.stgeorge.com.au/ibank/loginPage.action',
  },
  {
    id: 'bankwest',
    name: 'Bankwest',
    loginUrl: 'https://online.bankwest.com.au/Session/PersonalLogin',
  },
  {
    id: 'suncorp',
    name: 'Suncorp',
    loginUrl: 'https://internetbanking.suncorpbank.com.au/',
  },
  {
    id: 'up',
    name: 'Up',
    loginUrl: '',
  },
  {
    id: 'ubank',
    name: 'ubank',
    loginUrl: 'https://www.ubank.com.au/welcome/login/username',
  },
  {
    id: 'other',
    name: 'Other',
    loginUrl: '',
  },
] as const;

export function bankById(id: string | null | undefined): BankConfig | null {
  if (!id) return null;
  return BANKS.find((bank) => bank.id === id) ?? null;
}
