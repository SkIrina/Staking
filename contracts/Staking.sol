// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

contract Staking {
    IERC20 public rewardsToken;
    IERC20 public stakingToken;

    uint public rewardRatePercent = 20;
    uint public lastUpdateTime;

    uint public lockedTime = 1200;
    uint public rewardTime = 600;

    mapping(address => uint) public rewards;
    mapping(address => uint) public stakeStart;

    address public owner;

    uint private _totalSupply;
    mapping(address => uint) private _balances;

    constructor(address _stakingToken, address _rewardsToken) {
        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function setRate(uint _newRate) public onlyOwner {
        rewardRatePercent = _newRate;
    }

    function setLockedTime(uint _newTime) public onlyOwner {
        lockedTime = _newTime;
    }

    function earned(address account) public view returns (uint) {
        return
            _balances[account] * rewardRatePercent / 100 * ((block.timestamp - lastUpdateTime) / rewardTime)
            + rewards[account];
    }

    function _updateReward(address account) private {
        lastUpdateTime = block.timestamp;
        rewards[account] = earned(account);
    }

    function stake(uint _amount) external returns (bool) {
        require(_amount > 0, "No zero stakes");
        _updateReward(msg.sender);
        _totalSupply += _amount;
        _balances[msg.sender] += _amount;
        stakeStart[msg.sender] = block.timestamp;
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount, block.timestamp);
        return true;
    }

    function unstake() external returns (bool) {
        require(_balances[msg.sender] > 0, "Nothing to withdraw");
        _updateReward(msg.sender);
        uint amount = _balances[msg.sender];
        _totalSupply -= amount;
        _balances[msg.sender] = 0;

        if (block.timestamp - stakeStart[msg.sender] < lockedTime) {
            amount = amount - (amount / 5);
        }
        stakingToken.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, block.timestamp);
        return true;
    }

    function claim() external returns (bool) {
        _updateReward(msg.sender);
        require(rewards[msg.sender] > 0, "Nothing to claim");
        uint reward = rewards[msg.sender];
        rewards[msg.sender] = 0;
        rewardsToken.transfer(msg.sender, reward);
        emit Claimed(msg.sender, reward, block.timestamp);
        return true;
    }

    event Staked(address _account, uint256 _amount, uint256 timestamp);
    event Unstaked(address _account, uint256 _amount, uint256 timestamp);
    event Claimed(address _account, uint256 _amount, uint256 timestamp);
}

interface IERC20 {
    function totalSupply() external view returns (uint);

    function balanceOf(address account) external view returns (uint);

    function transfer(address recipient, uint amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}
