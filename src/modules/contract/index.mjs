
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
      ...otherArgs
    } = args;

    const {
      currentUser,
      db,
    } = this.ctx;

    const {
      id: currentUserId,
      // ethWallet: from,
    } = currentUser || {};


    if (!currentUserId) {
      return this.addError("Необходимо авторизоваться");
    }

    const user = await db.query.user({
      where: {
        id: currentUserId,
      },
    }, `{
      id
      EthAccounts{
        id
        address,
      }
    }`);


    if (!user) {
      return this.addError("Не был получен пользователь");
    }

    const {
      address: from,
    } = user.EthAccounts && user.EthAccounts[0] || {};


    if (!from) {
      return this.addError("Не был получен кошелек пользователя");
    }


    const contract = await this.query("ethContract", {
      where,
    }, `{
      id
      name
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
      this.addFieldError("password", "Не указан пароль для кошелька");
    }

    else {


      let contractsSource;


      try {
        contractsSource = solc.compile(source);
      }
      catch (error) {


        throw (error);
      }



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



          contracts.push({
            ...contract,
            name: contractName.replace(/^:*/, ''),
            abi: contractInterface,
          });

        }
      }

      let contractForDeploy = contracts.find(n => n.name === name);






      // return;

      if (!contractForDeploy) {
        this.addFieldError("name", "Не был получен публикуемый контракт");
      }
      else {

        const {
          abi,
          bytecode,
        } = contractForDeploy;



        await this.ethDeployContract({
          abi,
          bytecode,
          from,
          password,
        })
          .then(deployResult => {



            const {
              newContractInstance,
              txHash,
            } = deployResult;




            const {
              _jsonInterface,
              _address,
            } = newContractInstance;

            Object.assign(data, {
              Deployed: {
                create: {
                  name,
                  source,
                  address: _address,
                  txHash,
                  bytecode,
                  abi: _jsonInterface,
                  CreatedBy: {
                    connect: {
                      id: currentUserId,
                    },
                  },
                },
              },
            });

          });


      }

    }


    args = {
      where,
      data: {
        ...data
      },
      ...otherArgs
    };


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





    if (password) {
      const unlockResult = await web3.eth.personal.unlockAccount(from, password)
        .catch(e => {
          throw (e);
        });
    }

    return new Promise((resolve, reject) => {

      const data = `0x${bytecode}`;

      let txHash;

      myContract.deploy({
        data,
        arguments: params,
      })
        .send({
          from,
          gas,
          gasPrice,
        }, function (error, transactionHash) {

        })
        .on('error', function (error) {


          reject(error);

        })
        .on('transactionHash', function (transactionHash) {

          txHash = transactionHash;
        })
        .on('receipt', function (receipt) {

        })
        .on('confirmation', function (confirmationNumber, receipt) {

        })
        .then(function (newContractInstance) {



          resolve({
            newContractInstance,
            txHash,
          });
        });



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



    resolve(myContract);

  });

}


const callContractMethod = async function (contractMethod, source, args, ctx, info) {



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





  const result = await ethContractRead(source, {
    ...other,
    method: "mint",
    params: [to, amount],
  }, ctx, info);



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





  const result = await ethContractRead(source, {
    ...other,
    method: "ethChargeUserBalance",
    params: [to, amount],
  }, ctx, info);



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
      // ethContract,
      // ethContracts: this.ethContracts,
      // ethContractByAddress,

      ethContractsConnection: this.ethContractsConnection,
      ethContracts: this.ethContracts,
      ethContract: this.ethContract,

      ethDeployedContractsConnection: this.ethDeployedContractsConnection,
      ethDeployedContracts: this.ethDeployedContracts,
      ethDeployedContract: this.ethDeployedContract,

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

  async ethContracts(source, args, ctx, info) {
    return ctx.db.query.ethContracts(args, info);
  }

  async ethContract(source, args, ctx, info) {
    return ctx.db.query.ethContract(args, info);
  }


  async ethDeployedContractsConnection(source, args, ctx, info) {
    return ctx.db.query.ethDeployedContractsConnection(args, info);
  }

  async ethDeployedContracts(source, args, ctx, info) {
    return ctx.db.query.ethDeployedContracts(args, info);
  }

  async ethDeployedContract(source, args, ctx, info) {
    return ctx.db.query.ethDeployedContract(args, info);
  }

  // async ethContracts(source, args, ctx, info) {

  //   const {
  //     contractsSource,
  //   } = ctx;

  //   let contracts = [];


  //   const contractSol = `

  //   `;


  //   var output = solc.compile(contractSol.toString());




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
