import { Contract } from 'ethers';
import { getProvider, query } from '../utils/connector';
import verifyContract from './contract-compiler/compiler';
import verifyContractArguments from './contract-compiler/argumentEncoder';
import { checkIfContractIsERC20, extractERC20ContractData } from './contract-compiler/erc-checkers';
import {
  ABI, AutomaticContractVerificationReq, ERC20Data, License, Target, UserTokenBalance,
} from '../utils/types';
import { ensure } from '../utils/utils';
import { getAllUsersWithEvmAddress, insertTokenHolder } from './account';

interface Bytecode {
  bytecode: string;
}

interface Status {
  status: string;
}

interface ContracVerificationInsert {
  address: string;
  name: string;
  filename: string;
  source: string;
  runs: number,
  optimization: boolean;
  compilerVersion: string;
  args: string;
  target: string;
  success: boolean;
  errorMessage?: string;
}

type ContractType = 'other' | 'ERC20' | 'ERC721';
interface UpdateContract {
  name: string;
  target: Target;
  source: string;
  address: string;
  license?: License;
  optimization: boolean;
  abi: {[filename: string]: ABI};
  runs: number;
  args: string;
  filename: string;
  compilerVersion: string;
  type: ContractType;
  data: string;
}

const FIND_CONTRACT_BYTECODE = 'SELECT bytecode FROM contract WHERE address = $1';

const INSERT_VERIFIED_CONTRACT = `INSERT INTO verified_contract
  (address, name, filename, source,  optimization, compiler_version, compiled_data,  args, runs, target, type, contract_data)
VALUES 
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT DO NOTHING;`;

const INSERT_CONTRACT_VERIFICATION = `INSERT INTO verification_request
  (address, name, filename, source, runs, optimization, compiler_version, args, target, success, message)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT DO NOTHING;`;

const CONTRACT_VERIFICATION_STATUS = 'SELECT * FROM verification_request WHERE address = $1;';

const findContractBytecode = async (address: string): Promise<string> => {
  const bytecodes = await query<Bytecode>(FIND_CONTRACT_BYTECODE, [address]);
  ensure(bytecodes.length > 0, 'Contract does not exist', 404);
  return bytecodes[0].bytecode;
};

const insertVerifiedContract = async ({
  address, name, filename, source, optimization, compilerVersion, abi, args, runs, target, type, data,
}: UpdateContract): Promise<void> => {
  await query(
    INSERT_VERIFIED_CONTRACT,
    [address.toLowerCase(), name, filename, source, optimization, compilerVersion, JSON.stringify(abi), args, runs, target, type, data],
  );
};

export const contractVerificationInsert = async ({
  address, name, filename, source, runs, optimization, compilerVersion, args, target, success, errorMessage,
}: ContracVerificationInsert): Promise<void> => {
  await query(
    INSERT_CONTRACT_VERIFICATION,
    [
      address.toLowerCase(),
      name,
      filename,
      source,
      runs,
      optimization,
      compilerVersion,
      args,
      target,
      success,
      errorMessage || 'null',
    ],
  );
};

const updateUserBalances = async (abi: ABI, address: string, decimals: number): Promise<UserTokenBalance[]> => {
  const users = await getAllUsersWithEvmAddress();
  const contract = new Contract(address, abi, getProvider());
  const balances = await Promise.all(
    users.map(async ({ evmaddress }): Promise<string> => contract.balanceOf(evmaddress)),
  );
  const accountBalances: UserTokenBalance[] = users.map((user, index) => ({
    ...user, decimals, balance: balances[index], tokenAddress: address,
  }));
  return accountBalances;
};

export const verify = async (verification: AutomaticContractVerificationReq): Promise<void> => {
  const deployedBytecode = await findContractBytecode(verification.address.toLowerCase());
  const { abi, fullAbi } = await verifyContract(deployedBytecode, verification);
  verifyContractArguments(deployedBytecode, abi, verification.arguments);
  let type: ContractType = 'other';
  let data: ERC20Data | undefined;
  let userBalances: UserTokenBalance[] = [];
  if (checkIfContractIsERC20(abi)) {
    data = await extractERC20ContractData(verification.address, abi);
    type = 'ERC20';
    userBalances = await updateUserBalances(abi, verification.address, data.decimals);
  }
  await insertVerifiedContract({
    ...verification, abi: fullAbi, optimization: verification.optimization === 'true', args: verification.arguments, type, data: data ? JSON.stringify(data) : 'null',
  });
  await contractVerificationInsert({
    ...verification, success: true, optimization: verification.optimization === 'true', args: verification.arguments,
  });
  await insertTokenHolder(userBalances);
};

export const contractVerificationStatus = async (id: string): Promise<boolean> => {
  const result = await query<Status>(CONTRACT_VERIFICATION_STATUS, [id.toLowerCase()]);
  return result.length > 0;
};

export const findVeririedContract = async (address: string): Promise<ContracVerificationInsert[]> => query<ContracVerificationInsert>('SELECT * FROM verified_contract WHERE address = $1', [address]);