const LightningProtocol = artifacts.require("LightningProtocol");
const BigNumber = require('bignumber.js');
const Reverter = require('./helpers/reverter');

contract('LightningProtocolTest', async (accounts) => {
  let lightToken;

  const SOMEBODY = accounts[1];
  const NOBODY = accounts[2];
  const DECIMAL_FACTOR = BigNumber(100000000);

  const reverter = new Reverter(web3);

  before('setup', async ()=>{
    lightToken = await LightningProtocol.new(
        BigNumber(100000000).multipliedBy(DECIMAL_FACTOR),
        8,
        500,
        1200,
        50,
        156,
        BigNumber(1275000).multipliedBy(DECIMAL_FACTOR),
        5000);

    await reverter.snapshot();
  });

  afterEach('revert', reverter.revert);

  describe('transfer()', async  () => {
    it ('fee doesnt change when amount less than change', async () => {
      await lightToken.transfer(SOMEBODY, BigNumber(1) * DECIMAL_FACTOR);
      assert.equal(BigNumber(await lightToken._getBurnFee()).toString(), BigNumber(500).toString());
      assert.equal(BigNumber(await lightToken._getCycle()).toString(), BigNumber(0).toString());
      //1 token - 5% is 5 / 100
      assert.equal(BigNumber(await lightToken.balanceOf(SOMEBODY)).toString(), (BigNumber(1) * DECIMAL_FACTOR - (BigNumber(5)*DECIMAL_FACTOR)/100).toString());
    });
    it ('fee change one step', async () => {
      await lightToken.transfer(SOMEBODY, BigNumber(2000000).multipliedBy(DECIMAL_FACTOR));
      assert.equal(BigNumber(await lightToken._getBurnFee()).toString(), BigNumber(550).toString());
      assert.equal(BigNumber(await lightToken._getCycle()).toString(), BigNumber(0).toString());
      //with the fee of 5%
      let previousBalance = (BigNumber(2000000).multipliedBy(DECIMAL_FACTOR)).minus(BigNumber(100000).multipliedBy(DECIMAL_FACTOR));
      assert.equal(BigNumber(await lightToken.balanceOf(SOMEBODY)).toString(), previousBalance.toString());

      await lightToken.transfer(SOMEBODY, BigNumber(2000000).multipliedBy(DECIMAL_FACTOR));
      assert.equal(BigNumber(await lightToken._getBurnFee()).toString(), BigNumber(600).toString());
      assert.equal(BigNumber(await lightToken._getCycle()).toString(), BigNumber(0).toString());
      //other fee + previous balance
      assert.equal(BigNumber(await lightToken.balanceOf(SOMEBODY)).toString(),previousBalance.plus((BigNumber(2000000).multipliedBy(DECIMAL_FACTOR)).minus(BigNumber(110000).multipliedBy(DECIMAL_FACTOR))).toString());
    });
    it ('fee switch cycle and stay same', async () => {
      await lightToken.transfer(SOMEBODY, BigNumber(26000000).multipliedBy(DECIMAL_FACTOR));
      assert.equal(BigNumber(await lightToken._getBurnFee()).toString(), BigNumber(500).toString());
      assert.equal(BigNumber(await lightToken._getCycle()).toString(), BigNumber(1).toString());
      assert.equal(BigNumber(await lightToken.totalBurn()).toString(), (BigNumber(1300000).multipliedBy(DECIMAL_FACTOR)).toString());
      let totalSupply = BigNumber(100000000-1300000+637500).multipliedBy(DECIMAL_FACTOR);
      assert.equal(BigNumber(await lightToken.totalSupply()).toString(), totalSupply.toString());
      let balance = BigNumber(26000000-1300000).multipliedBy(DECIMAL_FACTOR);
      assert.equal(BigNumber(await lightToken.balanceOf(SOMEBODY)).toString(),(balance.plus(((BigNumber((26000000-1300000)*(637500)).multipliedBy(DECIMAL_FACTOR)).multipliedBy(DECIMAL_FACTOR)).dividedToIntegerBy(totalSupply))).toString());
    });
  });
});