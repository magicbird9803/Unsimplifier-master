import { dataDivisions, Pointer, type DataDivision } from "./elfBinary";
import { DataType } from "./dataType";
import { Vector3 } from "./misc";
import { ValueUuid, VALUE_UUID, type UuidTagged, DATA_TYPE } from "./valueIdentifier";

export type Typedef<T> = {[fieldName: string]: T}

const scriptDisclaimer = "To find the function's location, you can use \
[all_functions.json](https://gist.github.com/Darxoon/16bb8777d7f2f8dbef0f2516b8ddce65)."

export interface PropertyOptions {
	hidden?: boolean
	tabName?: string
	noSpaces?: boolean
}

export type PropertyType = "string" | "symbol" | "symbolAddr" | "Vector3" | "float"
	| "double" | "byte" | "bool8" | "bool32" | "short" | "int" | "long"

const NUMBER_TYPES = ["float", "double", "byte", "short", "int", "long"]

export function isNumber(fieldType: PropertyType): boolean {
	return NUMBER_TYPES.includes(fieldType)
}

export class Property<T extends PropertyType = PropertyType> {
	type: T
	description?: string
	hidden: boolean
	tabName?: string
	noSpaces: boolean
	
	constructor(type: T, description?: string, options?: PropertyOptions) {
		this.type = type
		this.description = description
		this.hidden = options?.hidden ?? false
		this.tabName = options?.tabName
		this.noSpaces = options?.noSpaces ?? false
	}
}


type RawTypedef<T extends number> = (typeof typedefs)[T]

type StrToType<T> = 
	T extends "string" ? string
	: T extends "symbol" ? any
	: T extends "symbolAddr" ? any
	: T extends "Vector3" ? Vector3
	
	: T extends "float" ? number
	: T extends "double" ? number
	: T extends "long" ? number
	: T extends "int" ? number
	: T extends "short" ? number
	: T extends "byte" ? number
	
	: T extends "bool8" ? boolean
	: T extends "bool32" ? boolean
	
	: never

type UnfilteredInstance<T extends number> = {
	-readonly [p in keyof RawTypedef<T>]: StrToType<RawTypedef<T>[p] extends Property<infer U> ? U : RawTypedef<T>[p]>
}

type GetMetadata<T extends number> = '__' extends keyof RawTypedef<T> ? RawTypedef<T>['__'] : {}
type GetParent<T extends number> = 'parent' extends keyof GetMetadata<T>
	? GetMetadata<T>['parent'] extends number ? UnfilteredInstance<GetMetadata<T>['parent']>
	: undefined
	: undefined

type RemoveNever<T> = Pick<T, {[p in keyof T]: T[p] extends never ? never : p}[keyof T]>

export type Instance<T extends number> = (GetParent<T> extends undefined
	? RemoveNever<UnfilteredInstance<T>>
	: RemoveNever<GetParent<T> & UnfilteredInstance<T>>
) & UuidTagged
// this is fine :)

const defaultDescriptions: Typedef<string> = {
	stage: "The stage that the {type} is on. It's the same for every {type} in the same file.",
	id: "The unique ID of the {type}, which can be used to identify it.",
	type: "The type of the {type}, which is a reference to data_{type_lowercase}.elf.",
	rotationDegrees: "The rotation in degrees around the {type}'s Y axis.",
	rotation: "The rotation euler angles in degrees. The X coordinate is the rotation in degrees around the {type}'s X axis, etc.",
	assetGroups: `
A list of all asset groups of this Model. 
An Asset Group is a group of related files all sharing the same name and directory
but having different file extensions.`,
	states: `
A list of all states. What a 'state' is and the difference between states and sub states 
are currently not known with certainty.`,
	
}

type TypeDefinition = {
	[fieldName: string]: PropertyType | Property | DataTypeMetadata
} & { __?: DataTypeMetadata }

interface DataTypeMetadata {
	parent?: DataType

	displayName?: string
	identifyingField?: string
	nestedAllValues?: boolean
	dataDivision?: DataDivision | null
	textVars?: {[key: string]: string}
	
	defaultPadding?: number
	
	childTypes?: Typedef<DataType>,
	childFieldLabel?: string
	childField?: string
	countSymbol?: string


	
	// for future sub-types
	// childField
	// childFieldLabel
	// countSymbol
}

const typedefs = {

	[DataType.DataUi]: {},
	
	[DataType.UiModel]: {
		__: {
			displayName: "Model",
			dataDivision: dataDivisions.model,
			childTypes: {
				properties: DataType.UiModelProperty,
			},
		},
		id: "string",
		modelFolder: "string",
		modelFileName: new Property("string", `
Not sure what this is for. It seems like it's the same as \`id\`.`),
		properties: new Property("symbol", undefined, {tabName: "Model Properties of {id}"}),
		propertyCount: new Property("int", undefined, {hidden: true}),
		field_0x24: "int",
	},
	
	[DataType.UiModelProperty]: {
		__: {
			displayName: "Model Property",
			dataDivision: dataDivisions.modelProperty,
			nestedAllValues: true,
		
		},	
		id: "string",
		model: "string",
		field_0x10: "string",
		field_0x18: "int",
		field_0x1c: "int",
		field_0x20: "float",
		field_0x24: "int",
		field_0x28: "string",
		field_0x30: "string",
		field_0x38: "int",
		field_0x3c: "int",
	},
	
	[DataType.UiMsg]: {
		__: {

			displayName: "Message",
			dataDivision: dataDivisions.msg,
		},	
		
		id: "string",
		modelAsset: "string",
		field_0x10: "string",
		field_0x18: "string",
		field_0x20: "string",
		openSfx: "string",
		closeSfx: "string",
		field_0x38: "float",
		field_0x3c: "float",
		field_0x40: "float",
		field_0x44: "float",
		field_0x48: "float",
		field_0x4c: "float",
		field_0x50: "float",
		field_0x54: "int",
		field_0x58: "string",
		field_0x5c: "int",
		field_0x60: "int",
		field_0x64: "int",
		field_0x68: "int",
		field_0x6c: "int",
		field_0x70: "string",
		field_0x78: "int",
		field_0x7c: "int",
	},
	
	[DataType.UiShop]: {
		__: {

			displayName: "Shop",
			dataDivision: dataDivisions.shop,
			childTypes: {
				soldItems: DataType.UiSellItem,
			},
		},

		id: "string",
		soldItems: new Property("symbol", undefined, {tabName: "Sold Items of {id}"}),
		soldItemCount: new Property("int", undefined, {hidden: true}),
		field_0x14: "int",
	},
	
	[DataType.UiSellItem]: {
		__: {

			displayName: "Sold Item",
			dataDivision: dataDivisions.sellItem,
			nestedAllValues: true,
		},

		id: "string",
		itemGiven: "string",
		quantityGiven: "int",
		field_0x14: "int",
		field_0x18: "int",
		field_0x1c: "int",
		field_0x20: "int",
		field_0x24: "int",
		availabilityEvent: new Property("string", `
The name of the event function that needs to be triggered before this item shows up in the shop.`),
		field_0x30: "string",
		field_0x38: "string",
		field_0x40: "string",
		field_0x48: "int",
		field_0x4c: "int",
		placementBone: new Property("string", `
The name of the bone on the map model's skeleton that the item will be tied to. This is how items are shown in shops.`),
		field_0x58: "int",
		field_0x5c: "int",
		field_0x60: "int",
		rowOrder: new Property("int", `
The order in which items can be selected in a row starting from 0, 1, 2 etc.`),
		columnOrder: new Property("int", `
The order in which items can be selected in a column starting from 0, 1, 2 etc.`),
		field_0x6c: "int",
	},
		
	[DataType.UiMenu]: {
		__: {

			displayName: "Menu",
			dataDivision: dataDivisions.menu,
		},

		stage: "string",
		id: "string",
		field_0x10: "string",
		field_0x18: "int",
		field_0x1c: "int",
		field_0x20: "string",
		field_0x28: "string",
		field_0x30: "string",
		field_0x38: "string",
		field_0x40: "string",
		field_0x48: "string",
		field_0x50: "string",
		field_0x58: "string",
		field_0x60: "string",
		field_0x68: "string",
		field_0x70: "string",
		field_0x78: "string",
		field_0x80: "string",
		field_0x88: "string",
		field_0x90: "string",
		field_0x98: "string",
		field_0xa0: "string",
		field_0xa8: "string",
		field_0xb0: "string",
		field_0xb8: "string",
		field_0xc0: "string",
		field_0xc8: "string",
		field_0xd0: "string",
		field_0xd8: "string",
		field_0xe0: "string",
		field_0xe8: "string",
		field_0xf0: "string",
		field_0xf8: "string",
		field_0x100: "string",
		field_0x108: "string",
		field_0x110: "string",
		field_0x118: "string",
		field_0x120: "string",
		field_0x128: "string",
		field_0x130: "string",
		field_0x138: "string",
		field_0x140: "string",
		field_0x148: "string",
		field_0x150: "string",
		field_0x158: "string",
		field_0x160: "string",
		field_0x168: "string",
		field_0x170: "string",
		field_0x178: "string",
	},

	[DataType.modelDataType]: {
		__: {
			displayName: "ModelDataRegistry",
		},
		
		stage: "string",
		id: "string",
		type: "string",
		position: "Vector3",
		rotationDegrees: "float",
		field_0x28: new Property("bool8", "Unsure what this field is."),
		isInvisibleOnLoad: new Property("bool8", "Flag that sets an NPC as invisible until activated by scripted event."),
		isEnemy: new Property("bool8", "Flag that sets an NPC as an Enemy"),
		field_0x2b: "byte",
		field_0x2c: "int",
		enemyEncounterId: "string",
		field_0x38: "int",
		field_0x3c: "int",
		associatedHouse: new Property("string", "ID of the house the NPC is in? null if it is not in a house"),
		associatedFlag: new Property("string", "Global Saved Work Flag (GSWF) associated to this NPC, purpose?"),
		field_0x50: "bool32",
		field_0x54: "int",
		formation0Id: "string",
		formation0Weight: "int",
		field_0x64: "bool32",
		formation1Id: "string",
		formation1Weight: "int",
		field_0x74: "bool32",
		formation2Id: "string",
		formation2Weight: "int",
		field_0x84: "bool32",
		formation3Id: "string",
		formation3Weight: "int",
		field_0x94: "bool32",
		field_0x98: "int",
		field_0x9c: "int",
		field_0xa0: "int",
		field_0xa4: "int",
		field_0xa8: "int",
		field_0xac: "float",
		field_0xb0: "float",
		field_0xb4: "float",
		field_0xb8: "float",
		field_0xbc: "float",
		walkOrigin: "Vector3",
		walkRadius: "Vector3",
		field_0xd8: "float",
		field_0xdc: "int",
		chaseOrigin: "Vector3",
		chaseRadius: "Vector3",
		field_0xf8: "int",
		field_0xfc: "int",
		field_0x100: new Property("string", "References stage name again, purpose?"),
		field_0x108: "int",
		field_0x10c: "int",
		field_0x110: "int",
		field_0x114: "int",
		field_0x118: "string",
		field_0x120: "int",
		field_0x124: "int",
		initFunction: new Property("string", "Function that runs when NPC is initialized."),
		field_0x130: "int",
		field_0x134: "int",
		field_0x138: "int",
		field_0x13c: "int",
		talkFunction: new Property("string", "Function that runs when NPC is talked to."),
		field_0x148: "int",
		field_0x14c: "int",
		field_0x150: "int",
		field_0x154: "int",
		field_0x158: "int",
		field_0x15c: "int",
		tattleEntry: new Property("string", "Tattle Entry used when Goombella tattles this NPC."),
		field_0x168: "int",
		field_0x16c: "int",
		field_0x170: "int",
		field_0x174: "int",
		field_0x178: "int",
		field_0x17c: "int",
	},

	[DataType.DataMaplinkZoom]: {
		__: {

		displayName: "Maplink Zoom",
		},

		id: "string",
		field_0x8: "int",
		field_0xc: "int",
		field_0x10: "int",
		field_0x14: "float",
		field_0x18: "string",
		field_0x20: "int",
		field_0x24: "int",
		field_0x28: "float",
		field_0x2c: "int",
		field_0x30: "float",
		field_0x34: "float",
	},

	[DataType.Npc]: {
		__: {
			displayName: "NPC",
		},
		
		stage: "string",
		id: "string",
		type: "string",
		position: "Vector3",
		rotationDegrees: "float",
		field_0x28: new Property("bool8", "Unsure what this field is."),
		isInvisibleOnLoad: new Property("bool8", "Flag that sets an NPC as invisible until activated by scripted event."),
		isEnemy: new Property("bool8", "Flag that sets an NPC as an Enemy"),
		field_0x2b: "byte",
		field_0x2c: "int",
		enemyEncounterId: "string",
		field_0x38: "int",
		field_0x3c: "int",
		associatedHouse: new Property("string", "ID of the house the NPC is in? null if it is not in a house"),
		associatedFlag: new Property("string", "Global Saved Work Flag (GSWF) associated to this NPC, purpose?"),
		field_0x50: "bool32",
		field_0x54: "int",
		formation0Id: "string",
		formation0Weight: "int",
		field_0x64: "bool32",
		formation1Id: "string",
		formation1Weight: "int",
		field_0x74: "bool32",
		formation2Id: "string",
		formation2Weight: "int",
		field_0x84: "bool32",
		formation3Id: "string",
		formation3Weight: "int",
		field_0x94: "bool32",
		field_0x98: "int",
		field_0x9c: "int",
		field_0xa0: "int",
		field_0xa4: "int",
		field_0xa8: "int",
		field_0xac: "float",
		field_0xb0: "float",
		field_0xb4: "float",
		field_0xb8: "float",
		field_0xbc: "float",
		walkOrigin: "Vector3",
		walkRadius: "Vector3",
		field_0xd8: "float",
		field_0xdc: "int",
		chaseOrigin: "Vector3",
		chaseRadius: "Vector3",
		field_0xf8: "int",
		field_0xfc: "int",
		field_0x100: new Property("string", "References stage name again, purpose?"),
		field_0x108: "int",
		field_0x10c: "int",
		field_0x110: "int",
		field_0x114: "int",
		field_0x118: "string",
		field_0x120: "int",
		field_0x124: "int",
		initFunction: new Property("string", "Function that runs when NPC is initialized."),
		field_0x130: "int",
		field_0x134: "int",
		field_0x138: "int",
		field_0x13c: "int",
		talkFunction: new Property("string", "Function that runs when NPC is talked to."),
		field_0x148: "int",
		field_0x14c: "int",
		field_0x150: "int",
		field_0x154: "int",
		field_0x158: "int",
		field_0x15c: "int",
		tattleEntry: new Property("string", "Tattle Entry used when Goombella tattles this NPC."),
		field_0x168: "int",
		field_0x16c: "int",
		field_0x170: "int",
		field_0x174: "int",
		field_0x178: "int",
		field_0x17c: "int",
	},
	[DataType.Item]: {
		__: {
			displayName: "Item",
		},
		
		stage: "string",
		id: "string",
		type: "string",
		position: "Vector3",
		field_0x24: "int",
		field_0x28: "int",
		field_0x2c: "int",
		field_0x30: "int",
		field_0x34: "int",
		field_0x38: "string",
		associatedHouse: "string",
		field_0x48: "int",
		field_0x4c: "int",
		field_0x50: "int",
		field_0x54: "float",
		field_0x58: "int",
		field_0x5c: "int",
		field_0x60: "int",
		field_0x64: "int",
		field_0x68: "int",
		field_0x6c: "int",
		field_0x70: "int",
		field_0x74: "int",
		field_0x78: "int",
		field_0x7c: "int",
		field_0x80: "int",
		field_0x84: "int",
		field_0x88: "int",
		field_0x8c: "int",
		field_0x90: "int",
		field_0x94: "int",
	},
	[DataType.Mobj]: {
		__: {
			displayName: "Mobj",
		},
		
		stage: "string",
		id: "string",
		type: "string",
		position: "Vector3",
		rotation: "Vector3",
		field_0x30: "int",
		field_0x34: "int",
		itemObtainedFlag: "string",
		associatedHouse: "string",
		field_0x48: "int",
		field_0x4c: "int",
		field_0x50: "int",
		shadowCastIntensity: new Property("float", "The intensity of the shadow cast under this object."),
		field_0x58: "int",
		field_0x5c: "int",
		itemDrop: "string",
		field_0x68: "int",
		field_0x6c: "int",
		field_0x70: "int",
		field_0x74: "int",
		field_0x78: "int",
		field_0x7c: "int",
		field_0x80: "int",
		field_0x84: "int",
		field_0x88: "int",
		field_0x8c: "int",
		parentMobj: "string",
		parentBone: "string",
		field_0xa0: "int",
		field_0xa4: "int",
		field_0xa8: "int",
		field_0xac: "int",
		field_0xb0: "int",
		field_0xb4: "int",
		field_0xb8: "int",
		itemDropDistance: new Property("float", "Distance from object the item travels after it appears (like when items drop out of blocks)."),
		field_0xc0: new Property("string", "Something Lct-related"),
		field_0xc8: "int",
		field_0xcc: "int",
		field_0xd0: "string",
		field_0xd8: "int",
		field_0xdc: "int",
		field_0xe0: "int",
		field_0xe4: "int",
		field_0xe8: "int",
		field_0xec: "int",
		field_0xf0: "int",
		field_0xf4: "int",
		field_0xf8: "string",
		field_0x100: "int",
		field_0x104: "int",
		field_0x108: "string",
		field_0x110: "int",
		field_0x114: "int",
		initScript: "string",
		field_0x120: "string",
		interactScript: "string",
		field_0x130: "string",
		damageScript: "string",
		field_0x140: new Property("string", "Script function; seems to be used for flurrie blowing and spring jumps?"),
		field_0x148: "int",
		field_0x14c: "int",
		field_0x150: "int",
		field_0x154: "int",
	},
	[DataType.Aobj]: {
		__: {
			displayName: "Aobj",
			// same as Mobj
			parent: DataType.Mobj,
		}
	},
	[DataType.Bshape]: {
		__: {
			displayName: "Bshape",
		},
		
		stage: "string",
		id: "string",
		position: "Vector3",
		rotation: "Vector3",
		field_0x28: "int",
		cubeSize: "Vector3",
		field_0x38: "int",
		field_0x3c: "int",
		associatedHouse: "string",
		field_0x48: "int",
		field_0x4c: "int",
	},
	[DataType.MaplinkHeader]: {
		__: {
			displayName: "Maplink Header",
		},
		
		stage: "string",
		linkAmount: new Property("int", undefined, { hidden: true }),
		field_0xc: "int",
		maplinks: new Property("symbol", undefined, { hidden: true }),
		field_0x18: "int",
		field_0x1c: "int",
		field_0x20: "int",
		field_0x24: "int",
		field_0x28: "int",
		field_0x2c: "int",
	},
	[DataType.Maplink]: {
		__:{
			dataDivision: dataDivisions.maplinkNodes,
			displayName: "Link",
		},		
		
		stage: "string",
		id: "string",
		destinationStage: "string",
		destinationId: "string",
		shape: "string",
		target: new Property("string", `
Type type of the link. Possible values:

* マリオ = (Mario)
*
`),		
		type: new Property("string", `
Type type of the link. Possible values:

* ベロ = Bero (Walk-Off Exit)
*ドア = Door 
* 土管：下 = Pipe: Under (Pipe is under you)
*
`),
		objectId: new Property("string", `This is for linking a map exit to a Mobj, BShape, or map collision`),
		rotationDegrees: "float",
		field_0x44: "int",
		field_0x48: "string",
		field_0x50: "int",
		field_0x54: "int",
		field_0x58: "string",
		field_0x60: "int",
		field_0x64: "int",
		field_0x68: "string",
		saveOnExit: "int",
		field_0x70: "int",
		direction: new Property("string", `
			The direction in which the link is facing. Possible values, among others:
			
			* 右後ろ - right back
			* 右 - right
			* 左 - left
			* Possibly more.`),			
		field_0x84: "int",
		field_0x88: "int",
		field_0x8c: "int",
		field_0x90: "int",
		field_0x94: "int",
		field_0x98: "int",
		field_0x9c: "int",
		field_0xa0: "int",
		field_0xa4: "int",
		enterFunction: new Property("string", `Either the function called when entering a stage, or entering a transition. Please check.\
\n\n${scriptDisclaimer}`),
		exitFunction: new Property("string", `Either the function called when exiting a stage, or exiting a transition. Please check.\
\n\n${scriptDisclaimer}`),
		field_0xb8: "int",
		field_0xbc: "int",
		field_0xc0: "int",
		field_0xc4: "int",
	},	
	[DataType.MapId]: {
		__: {
			displayName: "Map",
		},
		
		id: "string",
		field_0x8: "string",
		field_0x10: new Property("string", "Always the exact same as `id`"),
		groupName: "string",
		battleStage: "string",
		assetDirectory: new Property("string", "Directory inside romfs that contains this map's asset group"),
		assetName: new Property("string", `
File name of all asset files for this map.

For example, for the asset name 'gor_01', this field would reference:
 * <assetDir>/gor_01.bfres.zst
 * <assetDir>/gor_01.cam.zst
 * <assetDir>/gor_01.csb.zst
 * etc.`),
		field_0x38: "string",
		field_0x40: "int",
		field_0x44: "int",
		scriptLocation: new Property("string", "Path to script file relative to `romfs/script/wld/fld/map/`"),
		field_0x50: "string",
		field_0x58: "int",
		field_0x5c: "int",
		linkNumber: new Property("int", `
Two maps are linked together if they have the same number and aren't if they do not,
although this check will be skipped and the group name will be compared instead
if this number is 0.

Used for the loading of new maps (?)`),
		field_0x64: "int",
		field_0x68: new Property("string", `Either has the value null or "グループ" (english: group)`),
		field_0x70: "int",
		field_0x74: "int",
		field_0x78: "int",
		field_0x7c: "int",
		field_0x80: new Property("string", "Only used by the first 5 out of 6 `jon` maps and points ot `jon_00` there"),
		field_0x88: new Property("string", "Only used by the first 5 out of 6 `jon` maps and points ot `jon_00` there"),
		field_0x90: new Property("string", "Only used by the first 5 out of 6 `jon` maps and points ot `jon_00` there"),
	},

	[DataType.ModelAssetGroup]: {
		__: {
		displayName: "Asset Group",
		identifyingField: "fileName",
		nestedAllValues: true,
		dataDivision: dataDivisions.assetGroup,
			},
		
		modelFolder: "string",
		fileName: "string",
		field_0x10: "string",
		field_0x18: "int",
		field_0x1c: "int",
		field_0x20: "int",
		field_0x24: "int",
	},
	[DataType.ModelState]: {
		__: {
		displayName: "State",
		identifyingField: "description",
		childFieldLabel: "faceArrays",
		childField: "substates",
		nestedAllValues: true,
		dataDivision: dataDivisions.state,
		childTypes: {
			substates: DataType.ModelFaceGroup,
		},
	},		
		description: new Property("string", `
Description of the state, which doesn't seem to have an effect on its behavior.
Some commonly found translations:

* 通常 = normal
* ダメージ = damage
* 変形 = deformation/variation
`),
		substates: new Property("symbolAddr", undefined, {hidden: true}),
		substateCount: new Property("int", undefined, {hidden: true}),
		field_0x14: new Property("int", undefined, {hidden: true}),
	},
	
	[DataType.ModelFaceGroup]: {
		__: {
		displayName: "Face Array",
		nestedAllValues: true,
		dataDivision: dataDivisions.subState,
		childTypes: {
			faces: DataType.ModelFace,
		},
	},		

		
		field_0x0: "int",
		field_0x4: "int",
		faces: new Property("symbolAddr", undefined, {hidden: true}),
		faceCount: new Property("int", undefined, {hidden: true}),
		field_0x14: "int",
	},
	
	[DataType.ModelFace]: {
		__: {
		displayName: "Face",
		childField: "animations",
		nestedAllValues: true,
		dataDivision: dataDivisions.face,
		childTypes: {
			animations: DataType.ModelAnimation,
		},
	},

		
		field_0x0: "int",
		field_0x4: "int",
		// internally also called "anime"
		animations: new Property("symbolAddr", undefined, {hidden: true}),
		animationCount: new Property("int", undefined, {hidden: true}),
		field_0x14: "int",
	},
	
	[DataType.ModelAnimation]: {
		__: {
		displayName: "Animation",
		nestedAllValues: true,
		dataDivision: dataDivisions.anime,
	},
		description: "string",
		id: "string",

	},
	[DataType.ItemList]: {
		__: {
			displayName: "Item Table",
			childTypes: {
				items: DataType.ListItem,
			},
		},
		
		id: "string",
		items: new Property("symbolAddr", undefined, { tabName: "ItemTable {id}" }),
	},
	[DataType.ListItem]: {
		__: {
			displayName: "Item",
			identifyingField: "type",
			dataDivision: null,
		},
		
		type: "string",
		holdWeight: "int",
		dropWeight: "int",
	},
	[DataType.DataGobjModel]: {
		__: {

			displayName: "Gobj Model",
			countSymbol: "wld::fld::data::modelGobj_num",
			parent: DataType.modelDataType,
			childTypes: {
				assetGroups: DataType.ModelAssetGroup,
				states: DataType.ModelState,
			},
		},
		
	},
	[DataType.DataNpcModel]: {
		__: {

			displayName: "NPC Model",
			countSymbol: "wld::fld::data::modelNpc_num",
			parent: DataType.modelDataType,
			childTypes: {
				assetGroups: DataType.ModelAssetGroup,
				states: DataType.ModelState,
			},
		},
		
	},	
	[DataType.DataMobjModel]: {
		__: {

			displayName: "Mobj Model",
			countSymbol: "wld::fld::data::modelMobj_num",
			parent: DataType.modelDataType,

			childTypes: {
				assetGroups: DataType.ModelAssetGroup,
				states: DataType.ModelState,
			},
		},

	},


	[DataType.Gobj]: {
		stage: "string",
		id: "string",
		field_0x10: "int",
		field_0x14: "int",
		field_0x18: new Property("string", "Seems to be the exact same as the ID. \
It's probably referencing something somewhere else."),
		field_0x20: "int",
		field_0x24: "int",
		field_0x28: "int",
		field_0x2c: "int",
		field_0x30: "int",
		field_0x34: "int",
		field_0x38: "int",
		field_0x3c: "int",
		field_0x40: "int",
		field_0x44: "int",
		field_0x48: "int",
		field_0x4c: "int",
		field_0x50: "int",
		field_0x54: "int",
		field_0x58: "int",
		field_0x5c: "float",
		field_0x60: "float",
		field_0x64: "int",
		field_0x68: "int",
		field_0x6c: "int",
		field_0x70: "int",
		field_0x74: "int",
	},	
	[DataType.ResourceGobj]: {
		__: {

			displayName: "Gobj Resource",
			identifyingField: "type",
		},

		
		stage: "string",
		type: new Property("string", "The type of the Gobj Resource, which is a reference to data_gobj_model_GobjModel.elf."),
		field_0x10: "int",
		field_0x14: "int",
	},
	[DataType.DataEffect]: {
		__: {

			displayName: "Effect Type",
		},
		
		id: "string",
		emitterSetName: new Property("string", `
The name of the emitter set found in the effect folder inside the ptcl files.
might be the interaction function (called when pressing A; similar to talking).`),
		field_0x10: "int",
		field_0x14: "int",
		field_0x18: "string",
		field_0x20: "string",
		field_0x28: "string",
		field_0x30: "string",
		field_0x38: "string",
		field_0x40: "int",
		field_0x44: "int",
		field_0x48: "int",
		field_0x4c: "int",
		field_0x50: "int",
		field_0x54: "int",
		field_0x58: "int",
		field_0x5c: "int",
		field_0x60: "int",
		field_0x64: "int",
		field_0x68: "int",
		field_0x6c: "float",
		field_0x70: "float",
		field_0x74: "float",
		field_0x78: "int",
		field_0x7c: "int",
		field_0x80: "int",
		field_0x84: "int",
		field_0x88: "int",
		field_0x8c: "int",
		field_0x90: "int",
		field_0x94: "int",
	},
	[DataType.Effect]: {
		stage: "string",
		id: "string",
		type: "string",
		position: "Vector3",
		field_0x24: "int",
		field_0x28: "int",
		field_0x2c: "int",
		field_0x30: "float",
		field_0x34: "int",
		field_0x38: "int",
		field_0x3c: "int",
		field_0x40: "int",
		field_0x44: "int",
	},		
	[DataType.CharacterNpc]: {
		__: {
			displayName: "NPC Definition",
			defaultPadding: 1,
			textVars: {
				model: 'data_model_npc'
			},
		},
		
		id: "string",
		model: new Property("string", "Referencing models in 'data/model/{model}.elf.zst'"),
		field_0x10: "int",
		field_0x14: "int",
		field_0x18: "int",
		field_0x1c: "int",
		// TODO: add examples of functions in the instance script file
		scriptFileName: "string",
		scriptNamespace: new Property("string", `
The AngelScript namespace for the common instance functions inside the Script File (see Script File Name).`),
		field_0x30: "int",
		field_0x34: "int",
		field_0x38: "int",
		field_0x3c: "int",
		field_0x40: "int",
		field_0x44: "int",
		field_0x48: "int",
		field_0x4c: "int",
		field_0x50: "int",
		field_0x54: "int",
		field_0x58: "int",
		field_0x5c: "int",
		field_0x60: "string",
		field_0x68: "int",
		field_0x6c: "int",
		landingSfx: new Property("string", `
The sfx played when a character lands.`),
		jumpedOnSfx: new Property("string", `
The sfx played when a character is jumped on.`),
		hammerSfx: new Property("string", `
The sfx played when a character is hit with a hammer.`),
		jumpSfx: new Property("string", `
The sfx played when a character jumps.`),
		field_0x90: "string",
		hurtSfx: new Property("string", `
The sfx played when a character is hurt.`),
		talkSfx: new Property("string", `
The sfx played when a character talks.`),
		field_0xa8: "int",
		field_0xac: "int",
		field_0xb0: "int",
		field_0xb4: "int",
		field_0xb8: "int",
		field_0xbc: "int",
		field_0xc0: "int",
		field_0xc4: "int",
		field_0xc8: "int",
		field_0xcc: "int",
		walkingEffect: new Property("string", `
The effect emitter set used when the character walks.`),
		landingEffect: new Property("string", `
The effect emitter set used when the character lands from a jump.`),
		field_0xe0: "string",
		field_0xe8: "int",
		field_0xec: "int",
		field_0xf0: "int",
		field_0xf4: "int",
		field_0xf8: "int",
		field_0xfc: "int",
		field_0x100: "int",
		field_0x104: "int",
	},
	[DataType.CharacterMobj]: {
		__: {
			displayName: "Mobj Definition",
			defaultPadding: 1,
			textVars: {
				model: 'data_model_mobj'
			},
		},
		
		id: "string",
		field_0x8: "string",
		model: new Property("string", "Referencing models in 'data/model/data_model_mobj.elf.zst'"),
		field_0x18: "int",
		field_0x1c: "int",
		field_0x20: "int",
		field_0x24: "int",
		field_0x28: "int",
		field_0x2c: "int",
		field_0x30: "int",
		field_0x34: "int",
		field_0x38: "int",
		field_0x3c: "int",
		field_0x40: "int",
		field_0x44: "int",
		field_0x48: "int",
		field_0x4c: "int",
		scriptFileName: new Property("string", `
The name of the mobj's script file, relative to \`romfs/script/wld/fld/mobj/\``),
		initScript: new Property("string", "The script function for initializing the individual Mobj instance."),
		mainScript: new Property("string", "A script function (?)"),
		actionScript: new Property("string", "The script function for interacting with the Mobj."),
		field_0x70: "int",
		field_0x74: "int",
		field_0x78: "int",
		field_0x7c: "int",
		field_0x80: "int",
		field_0x84: "int",
		field_0x88: "int",
		field_0x8c: "int",
		field_0x90: "string",
		field_0x98: "int",
		field_0x9c: "int",
		field_0xa0: "int",
		field_0xa4: "int",
	},
	[DataType.CharacterParty]: {
		__: {
			displayName: "Party Member",
			defaultPadding: 1,
		},
		
		id: "string",
		model: new Property("string", "The Model ID this character uses. From data_model_npc.elf."),
		field_0x10: "int",
		field_0x14: "int",
		field_0x18: "int",
		field_0x1c: "int",
		field_0x20: "int",
		field_0x24: "int",
		instanceScriptFilename: new Property("string", "The filename of the instance script located in romfs\script\wld\fld\party."),
		instanceScriptNamespace: new Property("string", `
The namespace for the common instance functions of the NPC.
Appears to only apply to the file name given above.`),
		field_0x38: "bool32",
		field_0x3c: "int",
		landingSFX: new Property("string", "The SFX that plays when the character lands."),
		jumpedOnSFX: new Property("string", "The SFX that plays when the character is jumped on."),
		field_0x50: "string",
		hammerHitSFX: new Property("string", "The SFX that plays when the character is hit by the hammer."),
		field_0x60: "int",
		field_0x64: "int",
		talkSFX: new Property("string", "The SFX that plays when the character is talking."),
		field_0x70: "int",
		field_0x74: "int",
		field_0x78: "int",
		field_0x7c: "int",
		field_0x80: "int",
		field_0x84: "int",
		walkingGFX: new Property("string", "The GFX that plays when the character is walking."),
		landingGFX: new Property("string", "The GFX that plays when the character lands."),
		inGFX: new Property("string", "The GFX that plays when the character gets in something."),
		outGFX: new Property("string", "The GFX that plays when the character gets out of something."),
		loopingGFX: new Property("string", "The GFX that plays when the character is waiting in something."),
		loopEndGFX: new Property("string", "The GFX that plays when the looping GFX ends."),
	},
	[DataType.CharacterItem]: {
		__: {
			displayName: "Item Definition",
			defaultPadding: 1,
		},
		
		id: "string",
		description: "string",
		itemType: new Property("int", `
Specifies the type of the item. Possible values:

* 1 - Upgrade
* 2 - Literal key (?)
* 3 - Key item
* 4 - Crystal star
* 5 - Hearts, flowers, coins, etc.
* 6, 7 - ?
* 8 - Normal item (battle only)
* 9, 10, 11 - Normal item
* 12 - ?
* 13 to 18 - Badge
* 19 - ?
`),
		field_0x14: "int",
		field_0x18: "string",
		field_0x20: "string",
		field_0x28: "string",
		field_0x30: "string",
		field_0x38: "string",
		field_0x40: "short",
		field_0x42: "short",
		field_0x44: "short",
		field_0x46: "short",
		field_0x48: "short",
		usableInField: "bool8",
		usableInBattle: "bool8",
		field_0x4c: "byte",
		bpCost: "byte",
		hpRestored: "byte",
		fpRestored: "byte",
		field_0x50: "int",
		field_0x54: "int",
		field_0x58: "string",
		field_0x60: "string",
		field_0x68: "string",
		field_0x70: "string",
		field_0x78: "string",
		field_0x80: "string",
		field_0x88: "string",
		field_0x90: "string",
		field_0x98: "int",
		field_0x9c: "int",
	},
	[DataType.CharacterAobj]: {
		__: {
			parent: DataType.CharacterMobj,
			displayName: "Aobj Definition",
		},
	},
} as const satisfies {[dataType: number]: TypeDefinition}

function mapObject<A, B>(obj: {[key: string]: A}, fn: (value: [string, A], index: number) => [string, B]): {[key: string]: B} {
	return Object.fromEntries(Object.entries(obj).map(fn))
}
function filterObject<A>(obj: {[key: string]: A}, fn: (value: [string, A], index: number) => boolean): {[key: string]: A} {
	return Object.fromEntries(Object.entries(obj).filter(fn))
}

interface FileTypeRegistry {
	parent?: DataType
	typedef: Typedef<PropertyType>
	metadata: Typedef<Property>
	fieldOffsets: Typedef<number> & {[offset: number]: string}
	size: number
	displayName: string
	identifyingField: string
	dataDivision: DataDivision
	defaultPadding: number
	textVars: {[key: string]: string}

	childTypes?: Typedef<DataType>
	childFieldLabel?: string
	childField?: string
	countSymbol?: string
	nestedAllValues?: boolean
	entryPoints?: {[objectType: number]: any}

	instantiate(): object
}

console.time('generating FILE_TYPES')

// @ts-ignore
export const FILE_TYPES = mapObject(typedefs, ([dataTypeString, typedef]) => [dataTypeString, generateTypedefFor(parseInt(dataTypeString), typedef)])

console.timeEnd('generating FILE_TYPES')

function generateTypedefFor(dataType: DataType, typedef: TypeDefinition, extendedTypedef: Typedef<any>): FileTypeRegistry {

	let metadata: DataTypeMetadata = {...typedef.__}
	
	while (metadata.parent) {
		let parent = typedefs[metadata.parent]
		delete metadata.parent
		typedef = {...parent, ...typedef}
		metadata = {...parent.__, ...metadata}
	}
	
	const { displayName, dataDivision, identifyingField, childTypes, defaultPadding, textVars } = metadata
	
	let fields = new Map(Object.entries(typedef).flatMap(([fieldName, fieldType]) => {
		if (fieldType instanceof Property) {
			return [[fieldName, fieldType]]
		} else if (typeof fieldType == 'string') {
			return [[fieldName, new Property(fieldType)]]
		} else {
			return []
		}
	}))
	
	let fieldTypes = Object.fromEntries(
		[...fields.entries()].map(([fieldName, property]) => [fieldName, property.type])
	)
	
	let fieldMetadata: Typedef<Property> = {}
	
	for (const [fieldName, property] of fields) {
		let description = property.description ?? defaultDescriptions[fieldName]
		
		if (description) {
			if (textVars) {
				let vars = {
					'type': displayName,
					'type_lowercase': displayName?.toLowerCase(),
					...textVars,
				}
				
				for (const [key, value] of Object.entries(vars)) {
					description = description.replaceAll('{' + key + '}', value)
				}
			} else {
				description = description
					.replaceAll("{type}", displayName)
					.replaceAll("{type_lowercase}", displayName?.toLowerCase())
			}
		}
		
		const { type, tabName, noSpaces, hidden } = property
		fieldMetadata[fieldName] = new Property(type, description, { hidden, noSpaces, tabName })
	}
	
	const { fieldOffsets, size } = generateOffsets(fieldTypes)
	
	return {
		typedef: fieldTypes,
		metadata: fieldMetadata,
				
		fieldOffsets,
		size,
		
		displayName,
		identifyingField: identifyingField ?? "id",
		nestedAllValues:  typedef.nestedAllValues as unknown as boolean ?? false,
		dataDivision: dataDivision === null ? null : dataDivision ?? dataDivisions.main,
		textVars: textVars ?? {},
		
		defaultPadding: defaultPadding ?? 0,
		
		childTypes: childTypes ?? {},

		childFieldLabel: typedef.childFieldLabel as string ?? undefined,

		entryPoints: typedef.entryPoints as any,
		
		// for future sub-types
		// childField: typedef.__childField as string | undefined,
		// childFieldLabel: typedef.__childFieldLabel as string | undefined,
		// countSymbol: typedef.__countSymbol as string | undefined,
		
		instantiate(): object {
			let result = {}
			result[VALUE_UUID] = ValueUuid()
			result[DATA_TYPE] = dataType
			
			for (const [fieldName, type] of Object.entries(fieldTypes)) {
				result[fieldName] = type === "string" || type === "symbol" || type === "symbolAddr"
					? null
					: type === "Vector3"
						? Vector3.ZERO
						: type.startsWith("bool")
							? false
							: 0
			}
			
			return result
		},
	}
}

		
function generateOffsets(typedef: Typedef<PropertyType>) {
	let result: Typedef<number> & {[offset: number]: string} = {}
	let offset = 0
	for (const [fieldName, fieldType] of Object.entries(typedef)) {
		result[fieldName] = offset
		result[offset] = fieldName
		offset += {
			string: 8,
			symbol: 8,
			symbolAddr: 8,
			pointer: 8,
			Vector3: 12,
			float: 4,
			double: 8,
			byte: 1,
			bool8: 1,
			short: 2,
			int: 4,
			long: 8,
			bool32: 4,
		}[fieldType]
		
		if (isNaN(offset)) {
			throw new Error(`Field Offset is NaN, field name: ${fieldName}, field type: ${fieldType}`)
		}
	}

	return { fieldOffsets: result, size: offset }
}
