// src/services/supplierService.js
const Joi = require('joi');
const supplierModel = require('../models/supplierModel');
const AppError = require('../utils/errorUtils'); // Импорт AppError

const supplierSchema = Joi.object({
    company_name: Joi.string().required(),
    contact_person: Joi.string().optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    website: Joi.string().uri().optional(),
    legal_address: Joi.string().optional(),
    warehouse_address: Joi.string().optional(),
    bank_name: Joi.string().optional(),
    bank_account: Joi.string().optional(),
    tax_id: Joi.string().optional(),
    status: Joi.string()
        .valid('active', 'inactive', 'suspended')
        .default('active'),
    reliability_rating: Joi.number().integer().min(1).max(5).optional(),
    description: Joi.string().optional(),
    notes: Joi.string().optional(),
    payment_terms: Joi.string().optional(),
    delivery_terms: Joi.string().optional(),
    category_id: Joi.number().integer().optional(),
    delivery_time_days: Joi.number().integer().optional(),
    shipping_method: Joi.string().optional(),
});

const getAllSuppliers = async (query) => {
    const { page = 1, limit = 10, status, categoryId } = query;
    return supplierModel.getAllSuppliers({ page, limit, status, categoryId });
};

const getSupplierById = async (id) => {
    const supplier = await supplierModel.getSupplierById(id);
    if (!supplier) throw new AppError('Supplier not found', 404);
    return supplier;
};

const createSupplier = async (data) => {
    const { error } = supplierSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    return supplierModel.createSupplier(data);
};

const updateSupplier = async (id, data) => {
    const { error } = supplierSchema.validate(data, { stripUnknown: true });
    if (error) throw new AppError(error.details[0].message, 400);
    const supplier = await supplierModel.getSupplierById(id);
    if (!supplier) throw new AppError('Supplier not found', 404);
    return supplierModel.updateSupplier(id, data);
};

const deleteSupplier = async (id) => {
    const supplier = await supplierModel.getSupplierById(id);
    if (!supplier) throw new AppError('Supplier not found', 404);
    return supplierModel.deleteSupplier(id);
};

const getSuppliersByCategory = async (categoryId) => {
    return supplierModel.getSuppliersByCategory(categoryId);
};

module.exports = {
    getAllSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getSuppliersByCategory,
};
