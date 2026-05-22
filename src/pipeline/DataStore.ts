import UserModel from '../core/Mongo/Models/User.js'
import GroupModel from '../core/Mongo/Models/Group.js'
import DisabledCommandsModel from '../core/Mongo/Models/DisabledCommands.js'
import IFeatureModel from '../core/Mongo/Models/Features.js'
import BondModel from '../core/Mongo/Models/Bond.js'
import UserRizzModel from '../core/Mongo/Models/UserRizz.js'

export default class DataStore {
    user = UserModel
    group = GroupModel
    disabledcommands = DisabledCommandsModel
    feature = IFeatureModel
    bond = BondModel
    rizz = UserRizzModel
}