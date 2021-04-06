const Chord = artifacts.require("Chord");
const BigNumber = require('bignumber.js');
const Reverter = require('./helpers/reverter');
const truffleAssert = require('truffle-assertions');

contract('ChordTest', async (accounts) => {
        let chordToken;

    const SOMEBODY = accounts[1];
    const NOBODY = accounts[2];
    const DECIMAL_FACTOR = BigNumber(100000000);

    const reverter = new Reverter(web3);

    before('setup', async () => {
        chordToken = await Chord.new(
            BigNumber(100000000).multipliedBy(DECIMAL_FACTOR),
            8,
            500,
            1000,
            50,
            120,
            BigNumber(500000).multipliedBy(DECIMAL_FACTOR),
            5000);

        await reverter.snapshot();
    });

    afterEach('revert', reverter.revert);

    describe('transfer()', async () => {
        it('fee doesnt change when amount less than change', async () => {
            await chordToken.transfer(SOMEBODY, BigNumber(1) * DECIMAL_FACTOR);
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(500).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(0).toString());
            //1 token - 5% is 5 / 100
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), (BigNumber(1) * DECIMAL_FACTOR - (BigNumber(5) * DECIMAL_FACTOR) / 100).toString());
        });
        it('fee change one step', async () => {
            await chordToken.transfer(SOMEBODY, BigNumber(1500000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(550).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(0).toString());
            //with the fee of 5%
            let previousBalance = (BigNumber(1500000).multipliedBy(DECIMAL_FACTOR)).minus(BigNumber(75000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), previousBalance.toString());

            await chordToken.transfer(SOMEBODY, BigNumber(1500000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(650).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(0).toString());
            //other fee + previous balance
            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), previousBalance.plus((BigNumber(1500000).multipliedBy(DECIMAL_FACTOR)).minus(BigNumber(82500).multipliedBy(DECIMAL_FACTOR))).toString());
        });
        it('fee switch cycle and stay same', async () => {
            let balance = BigNumber(11000000).multipliedBy(DECIMAL_FACTOR);
            balance = BigNumber(await chordToken.reflectionFromToken(balance, true));
            await chordToken.transfer(SOMEBODY, BigNumber(11000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(550).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), (BigNumber(550000).multipliedBy(DECIMAL_FACTOR)).toString());

            let totalSupply = BigNumber(100000000 - 550000 + 250000).multipliedBy(DECIMAL_FACTOR);
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), totalSupply.toString());

            balance = BigNumber(await chordToken.tokenFromReflection(balance));

            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), (balance.plus(((BigNumber(250000).multipliedBy(balance)).multipliedBy(DECIMAL_FACTOR)).dividedToIntegerBy(totalSupply))).toString());
        });
        it('fee over two cycles, but switch to only one, stay the same, supply changed by fee sum', async () => {
            let balance = BigNumber(20500000).multipliedBy(DECIMAL_FACTOR);
            balance = BigNumber(await chordToken.reflectionFromToken(balance, true));
            await chordToken.transfer(SOMEBODY, BigNumber(20500000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(500).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), (BigNumber(1025000).multipliedBy(DECIMAL_FACTOR)).toString());

            let totalSupply = BigNumber(100000000 - 1025000 + 250000).multipliedBy(DECIMAL_FACTOR);
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), totalSupply.toString());

            balance = BigNumber(await chordToken.tokenFromReflection(balance));

            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), (balance.plus(((BigNumber(250000).multipliedBy(balance)).multipliedBy(DECIMAL_FACTOR)).dividedToIntegerBy(totalSupply))).toString());
        });
        it('fee over two cycles, but switch to only one, stays, next small transaction causes burn', async () => {
            let balanceReflection = BigNumber(22000000).multipliedBy(DECIMAL_FACTOR);
            balanceReflection = BigNumber(await chordToken.reflectionFromToken(balanceReflection, true));
            await chordToken.transfer(SOMEBODY, BigNumber(22000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(600).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), (BigNumber(1100000).multipliedBy(DECIMAL_FACTOR)).toString());

            let totalSupply = BigNumber(100000000 - 1100000 + 250000).multipliedBy(DECIMAL_FACTOR);
            assert.equal(BigNumber(await chordToken.totalSupply()).toString(), totalSupply.toString());

            let balance = BigNumber(await chordToken.tokenFromReflection(balanceReflection));

            assert.equal(BigNumber(await chordToken.balanceOf(SOMEBODY)).toString(), (balance.plus(((BigNumber(250000).multipliedBy(balance)).multipliedBy(DECIMAL_FACTOR)).dividedToIntegerBy(totalSupply))).toString());

            await chordToken.transfer(SOMEBODY, BigNumber(1000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(600).toString());
            assert.equal(BigNumber(await chordToken._getCycle()).toString(), BigNumber(2).toString());
            assert.equal(BigNumber(await chordToken.totalBurn()).toString(), (BigNumber(1100000 + 60).multipliedBy(DECIMAL_FACTOR)).toString());
        });
        it('transact without fee when cycle finished', async () => {
            let chordTokenCycle = await Chord.new(
                BigNumber(100000000).multipliedBy(DECIMAL_FACTOR),
                8,
                500,
                1000,
                50,
                1,
                BigNumber(500000).multipliedBy(DECIMAL_FACTOR),
                5000);

            await chordTokenCycle.transfer(SOMEBODY, BigNumber(1000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordToken._getBurnFee()).toString(), BigNumber(500).toString());
            await chordTokenCycle.transfer(SOMEBODY, BigNumber(11000000).multipliedBy(DECIMAL_FACTOR));
            assert.equal(BigNumber(await chordTokenCycle._getCycle()).toString(), BigNumber(1).toString());
            assert.equal(BigNumber(await chordTokenCycle._getBurnFee()).toString(), BigNumber(0).toString());
        });
    });
    describe('includeAccount()', async () => {
        it('must revert on included', async () => {
            await truffleAssert.reverts(chordToken.includeAccount(SOMEBODY), 'Account is already included');
        });
    });
    describe('excludeAccount()', async () => {
        it('must revert on excluded', async () => {
            await chordToken.excludeAccount(SOMEBODY);
            await truffleAssert.reverts(chordToken.excludeAccount(SOMEBODY), 'Account is already excluded');
        });
    });
});