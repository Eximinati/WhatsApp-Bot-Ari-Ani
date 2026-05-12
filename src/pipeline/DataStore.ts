import { IDBModels } from '../typings/index.js'
import UserModel from '../core/Mongo/Models/User.js'
import GroupModel from '../core/Mongo/Models/Group.js'
import SessionModel from '../core/Mongo/Models/Session.js'
import DisabledCommandsModel from '../core/Mongo/Models/DisabledCommands.js'
import IFeatureModel from '../core/Mongo/Models/Features.js'
import BondModel from '../core/Mongo/Models/Bond.js'
import UserRizzModel from '../core/Mongo/Models/UserRizz.js'

export default class DataStore implements IDBModels {
    user = UserModel
    group = GroupModel
    session = SessionModel
    disabledcommands = DisabledCommandsModel
    feature = IFeatureModel
    bond = BondModel
    rizz = UserRizzModel
}