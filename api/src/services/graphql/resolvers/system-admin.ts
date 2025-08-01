import type { GraphQLParams } from '@directus/types';
import { GraphQLBoolean, GraphQLID, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql';
import { SchemaComposer, toInputObjectType } from 'graphql-compose';
import { CollectionsService } from '../../collections.js';
import { ExtensionsService } from '../../extensions.js';
import { FieldsService } from '../../fields.js';
import { RelationsService } from '../../relations.js';
import { GraphQLService } from '../index.js';
import type { Schema } from '../schema/index.js';
import { getFieldType } from './get-field-type.js';
import { getRelationType } from './get-relation-type.js';
import { getCollectionType } from './get-collection-type.js';

export function resolveSystemAdmin(
	gql: GraphQLService,
	schema: Schema,
	schemaComposer: SchemaComposer<GraphQLParams['contextValue']>,
) {
	if (!gql.accountability?.admin) {
		return;
	}

	const Collection = getCollectionType(schemaComposer, schema, 'write');
	const Field = getFieldType(schemaComposer, schema, 'write');
	const Relation = getRelationType(schemaComposer, schema, 'write');

	schemaComposer.Mutation.addFields({
		create_collections_item: {
			type: Collection,
			args: {
				data: toInputObjectType(Collection, {
					postfix: '_input',
				}).addFields({
					fields: [toInputObjectType(Field, { postfix: '_input' }).NonNull],
				}).NonNull,
			},
			resolve: async (_, args) => {
				const collectionsService = new CollectionsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				const collectionKey = await collectionsService.createOne(args['data']);
				return await collectionsService.readOne(collectionKey);
			},
		},
		update_collections_item: {
			type: Collection,
			args: {
				collection: new GraphQLNonNull(GraphQLString),
				data: toInputObjectType(Collection, {
					postfix: '_input',
				}).removeField(['collection', 'schema']).NonNull,
			},
			resolve: async (_, args) => {
				const collectionsService = new CollectionsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				const collectionKey = await collectionsService.updateOne(args['collection'], args['data']);
				return await collectionsService.readOne(collectionKey);
			},
		},
		delete_collections_item: {
			type: schemaComposer.createObjectTC({
				name: 'delete_collection',
				fields: {
					collection: GraphQLString,
				},
			}),
			args: {
				collection: new GraphQLNonNull(GraphQLString),
			},
			resolve: async (_, args) => {
				const collectionsService = new CollectionsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				await collectionsService.deleteOne(args['collection']);
				return { collection: args['collection'] };
			},
		},
	});

	schemaComposer.Mutation.addFields({
		create_fields_item: {
			type: Field,
			args: {
				collection: new GraphQLNonNull(GraphQLString),
				data: toInputObjectType(Field, { postfix: '_input' }).NonNull,
			},
			resolve: async (_, args) => {
				const service = new FieldsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				await service.createField(args['collection'], args['data']);
				return await service.readOne(args['collection'], args['data'].field);
			},
		},
		update_fields_item: {
			type: Field,
			args: {
				collection: new GraphQLNonNull(GraphQLString),
				field: new GraphQLNonNull(GraphQLString),
				data: toInputObjectType(Field, { postfix: '_input' }).NonNull,
			},
			resolve: async (_, args) => {
				const service = new FieldsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				await service.updateField(args['collection'], {
					...args['data'],
					field: args['field'],
				});

				return await service.readOne(args['collection'], args['data'].field);
			},
		},
		delete_fields_item: {
			type: schemaComposer.createObjectTC({
				name: 'delete_field',
				fields: {
					collection: GraphQLString,
					field: GraphQLString,
				},
			}),
			args: {
				collection: new GraphQLNonNull(GraphQLString),
				field: new GraphQLNonNull(GraphQLString),
			},
			resolve: async (_, args) => {
				const service = new FieldsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				await service.deleteField(args['collection'], args['field']);
				const { collection, field } = args;
				return { collection, field };
			},
		},
	});

	schemaComposer.Mutation.addFields({
		create_relations_item: {
			type: Relation,
			args: {
				data: toInputObjectType(Relation, { postfix: '_input' }).NonNull,
			},
			resolve: async (_, args) => {
				const relationsService = new RelationsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				await relationsService.createOne(args['data']);
				return await relationsService.readOne(args['data'].collection, args['data'].field);
			},
		},
		update_relations_item: {
			type: Relation,
			args: {
				collection: new GraphQLNonNull(GraphQLString),
				field: new GraphQLNonNull(GraphQLString),
				data: toInputObjectType(Relation, { postfix: '_input' }).NonNull,
			},
			resolve: async (_, args) => {
				const relationsService = new RelationsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				await relationsService.updateOne(args['collection'], args['field'], args['data']);
				return await relationsService.readOne(args['data'].collection, args['data'].field);
			},
		},
		delete_relations_item: {
			type: schemaComposer.createObjectTC({
				name: 'delete_relation',
				fields: {
					collection: GraphQLString,
					field: GraphQLString,
				},
			}),
			args: {
				collection: new GraphQLNonNull(GraphQLString),
				field: new GraphQLNonNull(GraphQLString),
			},
			resolve: async (_, args) => {
				const relationsService = new RelationsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				await relationsService.deleteOne(args['collection'], args['field']);
				return { collection: args['collection'], field: args['field'] };
			},
		},
	});

	const Extension = schemaComposer.createObjectTC({
		name: 'directus_extensions',
		fields: {
			bundle: GraphQLString,
			name: new GraphQLNonNull(GraphQLString),
			schema: schemaComposer.createObjectTC({
				name: 'directus_extensions_schema',
				fields: {
					type: GraphQLString,
					local: GraphQLBoolean,
				},
			}),
			meta: schemaComposer.createObjectTC({
				name: 'directus_extensions_meta',
				fields: {
					enabled: GraphQLBoolean,
				},
			}),
		},
	});

	schemaComposer.Query.addFields({
		extensions: {
			type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(Extension.getType()))),
			resolve: async () => {
				const service = new ExtensionsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				return await service.readAll();
			},
		},
	});

	schemaComposer.Mutation.addFields({
		update_extensions_item: {
			type: Extension,
			args: {
				id: GraphQLID,
				data: toInputObjectType(
					schemaComposer.createObjectTC({
						name: 'update_directus_extensions_input',
						fields: {
							meta: schemaComposer.createObjectTC({
								name: 'update_directus_extensions_input_meta',
								fields: {
									enabled: GraphQLBoolean,
								},
							}),
						},
					}),
				),
			},
			resolve: async (_, args) => {
				const extensionsService = new ExtensionsService({
					accountability: gql.accountability,
					schema: gql.schema,
				});

				await extensionsService.updateOne(args['id'], args['data']);
				return await extensionsService.readOne(args['id']);
			},
		},
	});
}
