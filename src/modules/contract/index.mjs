
import PrismaModule from "@prisma-cms/prisma-module";

import PrismaProcessor from "@prisma-cms/prisma-processor";

import solc from "solc";
import chalk from "chalk";



export class EthContractProcessor extends PrismaProcessor {


  constructor(props) {

    super(props);

    this.objectType = "ethContract";

  }


  async create(objectType, args, info) {

    const {
      data: {
        ...data
      },
    } = args;

    const {
      currentUser,
    } = this.ctx;

    const {
      id: currentUserId,
    } = currentUser || {};


    Object.assign(args, {
      data: {
        ...data,
        CreatedBy: {
          connect: {
            id: currentUserId,
          },
        },
      },
    });

    return super.create(objectType, args, info)
  }


  async update(objectType, args, info) {

    const {
      where,
    } = args;

    const {
      currentUser,
    } = this.ctx;

    const {
      id: currentUserId,
    } = currentUser || {};


    const contract = await this.query("ethContract", {
      where,
    }, `{
      id
      CreatedBy{
        id
      }
    }`);

    const {
      CreatedBy: {
        id: createdById,
      },
    } = contract;

    // console.log("contract", contract);

    if (!createdById || createdById !== currentUserId) {
      return this.addError("Нельзя редактировать чужой контракт");
    }


    return super.update(objectType, args, info)
  }


  async mutate(method, args, info) {

    const {
      currentUser,
    } = this.ctx;

    const {
      id: currentUserId,
    } = currentUser || {};

    if (!currentUserId) {
      return this.addError("Необходимо авторизоваться");
    }


    let {
      data: {
        name,
        ...data
      },
    } = args;


    if (name !== undefined) {

      name = name.trim();

      if (!name) {
        this.addFieldError("name", "Не заполнено название контракта");
      }

    }

    args.data = {
      ...data,
      name,
    }

    return super.mutate(method, args);

  }



  async deployEthContractProcessor(objectType, args, info) {

    let {
      where,
      data: {
        password,
        ...data
      },
    } = args;

    const {
      currentUser,
    } = this.ctx;

    const {
      id: currentUserId,
      ethWallet: from,
    } = currentUser || {};


    const contract = await this.query("ethContract", {
      where,
    }, `{
      id
      name
      txHash
      source
      CreatedBy{
        id
      }
    }`);

    const {
      id: contractId,
      name,
      source,
      CreatedBy: {
        id: createdById,
      },
    } = contract;

    console.log("contract", contract);



    if (!createdById || createdById !== currentUserId) {
      this.addError("Нельзя деплоить чужой контракт");
    }

    else if (!from) {
      this.addError("Не был получен кошелек пользователя");
    }

    else if (!source) {
      this.addError("Не был получен исходный код контракта");
    }

    else if (!password) {
      this.addError("Не указан пароль для кошелька");
    }

    else {


      let contractsSource;


      try {
        contractsSource = solc.compile(source);
      }
      catch (error) {

        console.log(chalk.green("contract compile error"), error);
        throw (error);
      }

      // console.log(chalk.green("contractSource"), contractSource);

      let contracts = [];

      if (contractsSource) {

        for (var contractName in contractsSource.contracts) {

          const contract = contractsSource.contracts[contractName];

          let {
            interface: contractInterface,
          } = contract;

          if (contractInterface) {

            try {

              contractInterface = JSON.parse(contractInterface);

            }
            catch (e) {
              console.error
            }

          }

          // code and ABI that are needed by web3
          console.log(contractName + ': ' + contractsSource.contracts[contractName].bytecode)
          console.log(contractName + '; ' + JSON.parse(contractsSource.contracts[contractName].interface))

          contracts.push({
            ...contract,
            name: contractName.replace(/^:*/, ''),
            abi: contractInterface,
          });

        }
      }

      let contractForDeploy = contracts.find(n => n.name === name);


      // console.log(chalk.green("contracts"), contracts.map(({name}) => name));

      console.log(chalk.green("contractForDeploy"), name, contractForDeploy);

      // return;

      if (!contractForDeploy) {
        this.addFieldError("name", "Не был получен публикуемый контракт");
      }
      else {

        const {
          abi,
          bytecode,
        } = contractForDeploy;

        console.log(chalk.green("contractForDeploy abi"), abi);

        let deployResult = await this.ethDeployContract({
          abi,
          bytecode,
          from,
          password,
        });

        console.log(chalk.green("deployResult"), deployResult);
        console.log(chalk.green("abi"), abi);

      }

    }



    return this.updateWithResponse(objectType, args, info)
  }



  async ethDeployContract(args) {

    const {
      web3,
    } = this.ctx;

    let {
      abi: contractInterface,
      bytecode,
      params,
      from,
      password,
      gas = 3000000,
      gasPrice = 10 ** 9,
    } = args;

    // Если не указано от кого, выполняет от базового аккаунта
    if (!from) {

      // const coinbase = await web3.eth.getCoinbase()
      //   .then(r => r)
      //   .catch(e => {
      //     throw (e);
      //   });

      // if (!coinbase) {
      //   throw (new Error("Can not get coinbase"));
      // }

      // from = coinbase;

      throw (new Error("Не был получен кошелек пользователя"));
    }


    // const contractSource = await contract(source, args, ctx).then(r => r).catch(e => {
    //   throw (e);
    // });




    var myContract = new web3.eth.Contract(contractInterface);

    // console.log("params", params);
    // console.log("bytecode", bytecode);


    if (password) {
      const unlockResult = await web3.eth.personal.unlockAccount(from, password)
        .catch(e => {
          throw (e);
        });
    }

    return new Promise((resolve, reject) => {

      const data = `0x${bytecode}`;

      myContract.deploy({
        data,
        arguments: params,
      })
        .send({
          from,
          gas,
          gasPrice,
        }, function (error, transactionHash) {
          console.log("send transactionHash", transactionHash);
        })
        .on('error', function (error) {
          console.log("error", error);

          reject(error);

        })
        .on('transactionHash', function (transactionHash) {
          console.log("on transactionHash", transactionHash);
        })
        .on('receipt', function (receipt) {
          console.log("on receipt", receipt.contractAddress) // contains the new contract address
        })
        .on('confirmation', function (confirmationNumber, receipt) {
          // console.log("on confirmation", confirmationNumber, receipt);
        })
        .then(function (newContractInstance) {
          // console.log("newContractInstance", newContractInstance.options.address) // instance with the new contract address
          console.log("newContractInstance", newContractInstance) // instance with the new contract address

          resolve(newContractInstance);
        });

      console.log("myContract", myContract);

    });

  }


}



const ethContract = async function (source, args, ctx, info) {


  const {
    name,
  } = args;

  const result = await ethContracts(source, args, ctx);


  return result ? result.find(n => n.name === name) : null;
}


const ethContractByAddress = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;


  const {
    address,
  } = args;


  const contractSource = await contract(source, args, ctx).then(r => r).catch(e => {
    throw (e);
  });

  if (!contractSource) {
    throw ("Can not get contract");
  }

  const {
    abi: contractInterface,
    bytecode,
  } = contractSource;


  var myContract = new web3.eth.Contract(contractInterface);


  return new Promise((resolve, reject) => {


    myContract.options.address = address;

    console.log("myContract", myContract);

    resolve(myContract);

  });

}


const callContractMethod = async function (contractMethod, source, args, ctx, info) {

  console.log("callContractMethod args", args);

  let {
    method,
    params,
    from,
  } = args;

  const {
    web3,
  } = ctx;

  const contract = await ethContractByAddress(source, args, ctx);

  if (!contract) {
    throw (new Error("Can not get contract"));
  }


  if (!from) {

    const coinbase = await web3.eth.getCoinbase()
      .then(r => r)
      .catch(e => {
        throw (e);
      });

    if (!coinbase) {
      throw (new Error("Can not get coinbase"));
    }
    ;

    from = coinbase;
  }

  const {
    methods,
  } = contract;

  if (!methods || !methods[method]) {
    throw (new Error("Can not get method"));
  }

  const result = await methods[method].apply(this, params)[contractMethod]({
    from,
    gas: 3000000,
  })
    .then(r => r)
    .catch(error => {
      throw (error);
    });

  console.log("call result", result);

  return result;
}


const mint = async function (source, args, ctx, info) {

  const {
    masterPassword,
    to,
    amount,
    ...other
  } = args;

  const {
    web3,
  } = ctx;



  const coinbase = await web3.eth.getCoinbase()
    .then(r => r)
    .catch(e => {
      throw (e);
    });

  if (!coinbase) {
    throw (new Error("Can not get coinbase"));
  }


  const unlockResult = await web3.eth.personal.unlockAccount(coinbase, masterPassword)
    .catch(e => {
      throw (e);
    });


  console.log("unlockResult", unlockResult);


  const result = await ethContractRead(source, {
    ...other,
    method: "mint",
    params: [to, amount],
  }, ctx, info);

  console.log("call result", result);

  return result;
}


const ethChargeUserBalance = async function (source, args, ctx, info) {

  const {
    masterPassword,
    to,
    amount,
    ...other
  } = args;

  const {
    web3,
  } = ctx;



  const coinbase = await web3.eth.getCoinbase()
    .then(r => r)
    .catch(e => {
      throw (e);
    });

  if (!coinbase) {
    throw (new Error("Can not get coinbase"));
  }


  const unlockResult = await web3.eth.personal.unlockAccount(coinbase, masterPassword)
    .catch(e => {
      throw (e);
    });


  console.log("unlockResult", unlockResult);


  const result = await ethContractRead(source, {
    ...other,
    method: "ethChargeUserBalance",
    params: [to, amount],
  }, ctx, info);

  console.log("ethChargeUserBalance result", result);

  return result;
}

const ethContractCall = async function (source, args, ctx, info) {

  return callContractMethod("call", source, args, ctx, info);
}

const ethContractRead = async function (source, args, ctx, info) {

  return callContractMethod("send", source, args, ctx, info);
}





class ContractModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    this.Query = {
      ethContractsConnection: this.ethContractsConnection,
      // ethContract,
      ethContract: this.ethContract,
      // ethContracts: this.ethContracts,
      // ethContractByAddress,
    };

    this.Mutation = {
      // ethDeployContract,
      // ethContractCall,
      // ethContractRead,
      // mint,
      // ethChargeUserBalance,
      createEthContractProcessor: this.createEthContractProcessor.bind(this),
      updateEthContractProcessor: this.updateEthContractProcessor.bind(this),
      deployEthContractProcessor: this.deployEthContractProcessor.bind(this),
    }

    this.EthContractResponse = {
      data: (source, args, ctx, info) => {

        const {
          id,
        } = source.data || {};

        return id ? ctx.db.query.ethContract({
          where: {
            id,
          },
        }, info) : null;
      }
    }
  }



  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }


  getProcessorClass() {
    return EthContractProcessor;
  }


  createEthContractProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("EthContract", args, info);
  }

  updateEthContractProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).updateWithResponse("EthContract", args, info);
  }

  deployEthContractProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).deployEthContractProcessor("EthContract", args, info);
  }


  async ethContractsConnection(source, args, ctx, info) {
    return ctx.db.query.ethContractsConnection(args, info);
  }

  async ethContract(source, args, ctx, info) {
    return ctx.db.query.ethContract(args, info);
  }

  // async ethContracts(source, args, ctx, info) {

  //   const {
  //     contractsSource,
  //   } = ctx;

  //   let contracts = [];


  //   const contractSol = `

  //   `;


  //   var output = solc.compile(contractSol.toString());

  //   console.log("output", output);


  //   if (contractsSource) {

  //     for (var contractName in contractsSource.contracts) {

  //       const contract = contractsSource.contracts[contractName];

  //       let {
  //         abi: contractInterface,
  //       } = contract;

  //       if (contractInterface) {

  //         try {

  //           contractInterface = JSON.parse(contractInterface);

  //         }
  //         catch (e) {
  //           console.error
  //         }

  //       }

  //       contracts.push({
  //         ...contract,
  //         name: contractName.replace(/^:*/, ''),
  //         abi: contractInterface,
  //       });

  //     }
  //   }

  //   return contracts;
  // }



  // EthContractResponse() {

  //   return {
  //     data: (source, args, ctx, info) => {

  //       const {
  //         id,
  //       } = source.data || {};

  //       return id ? ctx.db.query.ethContract({
  //         where: {
  //           id,
  //         },
  //       }, info) : null;
  //     }
  //   }
  // }


  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
      EthContractResponse: this.EthContractResponse,
    });

    return resolvers;
  }

}

export default ContractModule;
