import { Response } from 'express';
import {
  findContractDB, findERC20Token, findTokenAccountTokenBalance, findTokenInfo, getERC20Tokens,
} from '../services/contract';
import { AppRequest } from '../utils/types';
import { ensure, ensureObjectKeys, errorStatus } from '../utils/utils';

export const findToken = async (req: AppRequest<{}>, res: Response) => {
  try {
    ensure(!!req.params.address, 'Url paramter address is missing');
    const token = await findTokenInfo(req.params.address.toLowerCase());

    res.send(token);
  } catch (err) {
    res.status(errorStatus(err)).send(err.message);
  }
};

export const findContract = async (req: AppRequest<{}>, res: Response) => {
  try {
    ensure(!!req.params.address, 'Url paramter address is missing');
    const contracts = await findContractDB(req.params.address.toLowerCase());
    ensure(contracts.length > 0, 'Contract does not exist');

    res.send(contracts[0]);
  } catch (err) {
    res.status(errorStatus(err)).send(err.message);
  }
};

export const getAllERC20Tokens = async (_, res: Response) => {
  try {
    const tokens = await getERC20Tokens();
    res.send({ tokens: [...tokens] });
  } catch (err) {
    res.status(errorStatus(err)).send(err.message);
  }
};

interface TokenBalanceParam {
  accountAddress: string;
  contractAddress: string;
}

export const accountTokenBalance = async (req: AppRequest<TokenBalanceParam>, res: Response): Promise<void> => {
  try {
    ensureObjectKeys(req.body, ['accountAddress', 'contractAddress']);
    const tokenBalances = await findTokenAccountTokenBalance(req.body.accountAddress.toLowerCase(), req.body.contractAddress.toLowerCase());

    if (tokenBalances.length === 0) {
      const decimals = await findERC20Token(req.body.contractAddress);
      res.send({ balance: 0, decimals });
    }
    res.send({ balance: tokenBalances[0].balance, decimals: tokenBalances[0].decimals });
  } catch (err) {
    res.status(errorStatus(err)).send(err.message);
  }
};