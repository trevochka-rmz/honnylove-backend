// src/controllers/supplierController.js
const supplierService = require('../services/supplierService');

const getSuppliers = async (req, res, next) => {
    try {
        const suppliers = await supplierService.getAllSuppliers(req.query);
        res.json(suppliers);
    } catch (err) {
        next(err);
    }
};

const getSupplierById = async (req, res, next) => {
    try {
        const supplier = await supplierService.getSupplierById(req.params.id);
        res.json(supplier);
    } catch (err) {
        next(err);
    }
};

const createSupplier = async (req, res, next) => {
    try {
        const supplier = await supplierService.createSupplier(req.body);
        res.status(201).json(supplier);
    } catch (err) {
        next(err);
    }
};

const updateSupplier = async (req, res, next) => {
    try {
        const supplier = await supplierService.updateSupplier(
            req.params.id,
            req.body
        );
        res.json(supplier);
    } catch (err) {
        next(err);
    }
};

const deleteSupplier = async (req, res, next) => {
    try {
        await supplierService.deleteSupplier(req.params.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
};
